'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { crearComentarioDeSerie } from '@/ai/entrenador/serie.js';
import { crearVoz } from '@/ai/vega/voz.js';
import Card from '@/components/Card';
import { EJERCICIOS, crearEntrenamiento } from '@/lib/entrenador/ejercicios';
import { armarPayloadSerie } from '@/lib/entrenador/resumen';
import { guardarLecturas, useLecturas } from '@/lib/datos/lecturas';
import { maxNivel } from '@/lib/niveles';
import { TARJETAS, nivelDeTarjeta, valoresDelDia } from '@/lib/mock/indicadores';
import { ALERTA_ACTIVA, MISION, SOL_ACTUAL } from '@/lib/mock/mision';
import styles from './Entrenador.module.scss';

// WASM: lo copia `npm install` a public/mediapipe/wasm. Modelo: por defecto del CDN de Google;
// para trabajar sin conexión, bajar el .task a public/mediapipe/ y apuntar la variable de entorno.
const WASM = '/mediapipe/wasm';
const MODELO =
  process.env.NEXT_PUBLIC_POSE_MODEL_URL ||
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

const TEXTO_FASE = { inicio: 'Ponete en posición', arriba: 'Arriba', bajando: 'Bajando', abajo: 'Abajo', subiendo: 'Subiendo', sosteniendo: 'Sostené', corregir: 'Corregí la postura', fuera: 'Ponete en plancha' };
const MAX_FOTOS = 3;
const MAX_CARACTERES_FOTO = 2_500_000;

const ORIGEN_COMENTARIO = {
  guardada: 'Respuesta guardada de la IA',
  local: 'Comentario local con tus métricas de esta serie (sin conexión con la IA)',
};

function capturarFoto(video) {
  if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return null;
  const escala = Math.min(1, 640 / video.videoWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(video.videoWidth * escala));
  canvas.height = Math.max(1, Math.round(video.videoHeight * escala));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL('image/jpeg', 0.75);
  const data = url.replace(/^data:image\/jpeg;base64,/, '');
  if (!data || data.length > MAX_CARACTERES_FOTO) return null;
  return { media_type: 'image/jpeg', data };
}

export default function Entrenador() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const marcoRef = useRef(null);
  const estadoRef = useRef({});
  const vozVegaRef = useRef(null);
  const comentarioIdRef = useRef(0);

  const lecturas = useLecturas();
  const lecturasRef = useRef(lecturas);
  lecturasRef.current = lecturas;

  const [pantalla, setPantalla] = useState('reposo'); // reposo | cargando | activo | resumen | error
  const [error, setError] = useState(null);
  const [ejercicio, setEjercicio] = useState('sentadilla');
  const [estado, setEstado] = useState({ reps: 0, fase: 'inicio', angulo: null, segundos: 0, valido: true, correccion: null });
  const [voz, setVoz] = useState(true);
  const [resumen, setResumen] = useState(null);
  const [comentarioEstado, setComentarioEstado] = useState('reposo'); // reposo | cargando | listo
  const [comentarioVega, setComentarioVega] = useState(null);

  const vozRef = useRef(true);
  useEffect(() => {
    vozVegaRef.current = crearVoz();
    return () => {
      comentarioIdRef.current += 1;
      vozVegaRef.current?.callar();
    };
  }, []);

  useEffect(() => {
    vozRef.current = voz;
    if (!voz) {
      window.speechSynthesis?.cancel();
      vozVegaRef.current?.callar();
    }
  }, [voz]);

  const r = estadoRef.current; // referencias mutables del entrenamiento en curso

  // ── Voz: cuenta las repeticiones y lee las correcciones (sin repetirlas seguido) ──
  const hablar = useCallback((texto, { minimoMs = 0 } = {}) => {
    if (!vozRef.current || !('speechSynthesis' in window)) return;
    const ahora = performance.now();
    if (ahora - (r.ultimaVoz ?? 0) < minimoMs) return;
    r.ultimaVoz = ahora;
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'es-AR';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }, [r]);

  const apagar = useCallback(() => {
    cancelAnimationFrame(r.raf);
    r.stream?.getTracks().forEach((t) => t.stop());
    r.stream = null;
    r.landmarker?.close();
    r.landmarker = null;
    window.speechSynthesis?.cancel();
  }, [r]);

  useEffect(() => apagar, [apagar]);

  // ── Dibujo del esqueleto sobre el video ──
  function dibujar(puntos, conexiones) {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (canvas.width !== video.videoWidth) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!puntos) return;
    const px = (p) => [p.x * canvas.width, p.y * canvas.height];
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#5BC8F5';
    for (const { start, end } of conexiones) {
      if (start < 11 || end < 11) continue; // sin la cara
      const a = puntos[start];
      const b = puntos[end];
      if ((a.visibility ?? 1) < 0.5 || (b.visibility ?? 1) < 0.5) continue;
      ctx.beginPath();
      ctx.moveTo(...px(a));
      ctx.lineTo(...px(b));
      ctx.stroke();
    }
    ctx.fillStyle = '#FFFFFF';
    puntos.forEach((p, i) => {
      if (i < 11 || (p.visibility ?? 1) < 0.5) return;
      ctx.beginPath();
      ctx.arc(...px(p), 5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // ── Bucle: un fotograma de video → puntos → lógica del ejercicio ──
  function bucle(conexiones) {
    const video = videoRef.current;
    if (!r.landmarker || !video) return;
    if (video.readyState >= 2 && video.currentTime !== r.ultimoTiempo) {
      r.ultimoTiempo = video.currentTime;
      const ahora = performance.now();
      const puntos = r.landmarker.detectForVideo(video, ahora).landmarks?.[0];
      dibujar(puntos, conexiones);
      if (puntos) {
        const e = r.entrenamiento.procesar(puntos, { t: ahora, relacion: video.videoWidth / video.videoHeight });
        if (e.angulo !== null) {
          r.anguloMin = r.anguloMin == null ? e.angulo : Math.min(r.anguloMin, e.angulo);
        }
        // Captura hasta 3 fotos clave durante la serie: inicio válido, momento clave/corrección y cierre.
        if (e.valido && (r.fotos?.length ?? 0) < MAX_FOTOS) {
          const esMomentoClave = e.fase === 'abajo' || e.fase === 'sosteniendo' || Boolean(e.correccion);
          const pasoTiempo = ahora - (r.ultimaFotoMs ?? 0) > 2500;
          if (r.fotos.length === 0 || (esMomentoClave && pasoTiempo)) {
            const foto = capturarFoto(video);
            if (foto) {
              r.fotos.push(foto);
              r.ultimaFotoMs = ahora;
            }
          }
        }
        const clave = `${e.reps}|${e.fase}|${e.segundos}|${e.correccion}|${e.valido}`;
        if (clave !== r.clave) {
          if (e.reps > (r.repsPrevias ?? 0) && e.reps) hablar(String(e.reps));
          r.repsPrevias = e.reps;
          if (e.correccion && e.correccion !== r.ultimaCorreccion) hablar(e.correccion, { minimoMs: 4000 });
          r.ultimaCorreccion = e.correccion;
          r.clave = clave;
          setEstado(e);
        }
      }
    }
    r.raf = requestAnimationFrame(() => bucle(conexiones));
  }

  async function empezar() {
    setError(null);
    setPantalla('cargando');
    try {
      const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(WASM);
      const opciones = (delegate) => ({ baseOptions: { modelAssetPath: MODELO, delegate }, runningMode: 'VIDEO', numPoses: 1 });
      try {
        r.landmarker = await PoseLandmarker.createFromOptions(vision, opciones('GPU'));
      } catch {
        r.landmarker = await PoseLandmarker.createFromOptions(vision, opciones('CPU'));
      }
      r.stream = await navigator.mediaDevices.getUserMedia({ video: { width: 960, height: 540, facingMode: 'user' }, audio: false });
      setPantalla('activo');
      await new Promise((ok) => requestAnimationFrame(ok)); // espera a que exista el <video>
      videoRef.current.srcObject = r.stream;
      await videoRef.current.play();

      r.entrenamiento = crearEntrenamiento(ejercicio);
      r.serie = [];
      r.fotos = [];
      r.ultimaFotoMs = 0;
      r.anguloMin = null;
      r.inicio = performance.now();
      r.clave = null;
      r.repsPrevias = 0;
      setEstado({ reps: 0, fase: 'inicio', angulo: null, segundos: 0, valido: true, correccion: null });
      hablar(`${EJERCICIOS[ejercicio].nombre}. Empezá cuando quieras.`);
      bucle(PoseLandmarker.POSE_CONNECTIONS);
    } catch (e) {
      apagar();
      setPantalla('error');
      setError(
        e?.name === 'NotAllowedError'
          ? 'No hay permiso para usar la cámara. Habilitala en el navegador y probá de nuevo.'
          : e?.name === 'NotFoundError'
            ? 'No se encontró ninguna cámara.'
            : `No se pudo iniciar el entrenador (${e?.message ?? 'error desconocido'}). Revisá la conexión: el modelo se descarga la primera vez.`,
      );
    }
  }

  // Cambiar de ejercicio guarda lo hecho en la serie y arranca un contador nuevo.
  function cambiar(id) {
    if (pantalla === 'activo') {
      const hecho = r.entrenamiento.resumen();
      if (hecho.reps || hecho.segundos) r.serie.push(hecho);
      r.entrenamiento = crearEntrenamiento(id);
      r.clave = null;
      r.repsPrevias = 0;
      setEstado({ reps: 0, fase: 'inicio', angulo: null, segundos: 0, valido: true, correccion: null });
      hablar(EJERCICIOS[id].nombre);
    }
    setEjercicio(id);
  }

  // Al terminar: guarda los minutos como lectura, suma la racha y pide el comentario + plan ajustado a Vega.
  async function terminar() {
    const hecho = r.entrenamiento.resumen();
    const series = [...r.serie, ...(hecho.reps || hecho.segundos ? [hecho] : [])];
    const minutos = Math.max(0.1, Math.round(((performance.now() - r.inicio) / 60000) * 10) / 10);

    const fotos = [...(r.fotos ?? [])];
    if (fotos.length < MAX_FOTOS) {
      const fotoFinal = capturarFoto(videoRef.current);
      if (fotoFinal) fotos.push(fotoFinal);
    }
    const anguloMin = r.anguloMin ?? null;
    apagar();

    const nota = series
      .map((s) => `${s.ejercicio === 'plancha' ? `${s.segundos} s de plancha` : `${s.reps} ${EJERCICIOS[s.ejercicio].nombre.toLowerCase()}`}`)
      .join(', ');
    const racha = MISION.rachaEjercicio + 1; // hoy ya cuenta (la racha de la misión llega hasta ayer)
    guardarLecturas([{ indicator: 'exercise_min', value: minutos, unit: 'min', sol: SOL_ACTUAL, source: 'camera', note: nota || 'sin repeticiones' }]);
    setResumen({ series, minutos, racha, fotos });
    setComentarioVega(null);
    setComentarioEstado('cargando');
    setPantalla('resumen');

    const idPedido = ++comentarioIdRef.current;
    const vals = valoresDelDia(lecturasRef.current, SOL_ACTUAL);
    const nivelMotor = maxNivel(TARJETAS.map((t) => nivelDeTarjeta(t, vals)), ALERTA_ACTIVA.nivel);
    const payload = armarPayloadSerie({
      series,
      ejercicioActual: ejercicio,
      minutos,
      anguloMin,
      fotos,
      vals,
      nivelMotor,
      alertaTitulo: ALERTA_ACTIVA.titulo,
    });

    const vozCliente = {
      hablar: (texto) => (vozRef.current ? vozVegaRef.current?.hablar(texto) : Promise.resolve()),
    };
    const respuesta = await crearComentarioDeSerie({ voz: vozCliente }).comentar(payload);
    if (idPedido !== comentarioIdRef.current) return;
    setComentarioVega(respuesta);
    setComentarioEstado('listo');
  }

  function otraVez() {
    comentarioIdRef.current += 1;
    vozVegaRef.current?.callar();
    setResumen(null);
    setComentarioVega(null);
    setComentarioEstado('reposo');
    setPantalla('reposo');
  }

  const e = EJERCICIOS[ejercicio];
  const esPlancha = ejercicio === 'plancha';
  const activo = pantalla === 'activo';

  return (
    <div className={styles.pantalla}>
      <header className={styles.encabezado}>
        <div>
          <h1>Entrenador</h1>
          <p className={styles.sub}>Contá repeticiones y corregí la postura con la cámara de la notebook · {MISION.rachaEjercicio} días de racha</p>
        </div>
        <label className={styles.voz}>
          <input type="checkbox" checked={voz} onChange={(ev) => setVoz(ev.target.checked)} /> Voz
        </label>
      </header>

      <div className={styles.ejercicios} role="radiogroup" aria-label="Ejercicio">
        {Object.values(EJERCICIOS).map((x) => (
          <button
            key={x.id}
            type="button"
            role="radio"
            aria-checked={ejercicio === x.id}
            className={ejercicio === x.id ? styles.activo : ''}
            onClick={() => cambiar(x.id)}
            disabled={pantalla === 'cargando'}
          >
            <span aria-hidden="true">{x.icono}</span> {x.nombre}
          </button>
        ))}
      </div>

      {pantalla !== 'resumen' && (
        <div className={styles.cuerpo}>
          <div className={styles.escena} ref={marcoRef}>
            {/* El video y el esqueleto se espejan para que se vea como un espejo. */}
            <div className={styles.espejo} hidden={!activo}>
              <video ref={videoRef} playsInline muted className={styles.video} />
              <canvas ref={canvasRef} className={styles.canvas} />
            </div>

            {!activo && (
              <div className={styles.portada}>
                <p className={styles.consejo}>{e.consejo}</p>
                <button type="button" className={`${styles.boton} ${styles.primario}`} onClick={empezar} disabled={pantalla === 'cargando'}>
                  {pantalla === 'cargando' ? 'Cargando cámara y modelo…' : '📷 Empezar con la cámara'}
                </button>
                {error && <p className={styles.error} role="alert">{error}</p>}
              </div>
            )}

            {activo && estado.correccion && (
              <p className={styles.correccion} role="status">
                ⚠ {estado.correccion}
              </p>
            )}
          </div>

          <div className={styles.lado}>
            <Card titulo={e.nombre}>
              <p className={styles.contador} aria-live="polite">
                {esPlancha ? estado.segundos : estado.reps}
                <small> {e.unidad}</small>
              </p>
              <p className={styles.fase}>{activo ? TEXTO_FASE[estado.fase] ?? estado.fase : 'Esperando la cámara'}</p>
              {activo && estado.angulo !== null && <p className={styles.dato}>Ángulo: {estado.angulo}°</p>}
              {activo && !estado.valido && <p className={styles.dato}>No te veo bien: ubicate de costado.</p>}
            </Card>

            <button type="button" className={`${styles.boton} ${styles.primario}`} onClick={terminar} disabled={!activo}>
              Terminar y guardar
            </button>
            <p className={styles.nota}>Se guardan los minutos de ejercicio y se suma a tu racha.</p>
          </div>
        </div>
      )}

      {pantalla === 'resumen' && resumen && (
        <div className={styles.resumenGrid}>
          <Card titulo="Resumen" acento="green" className={styles.resumen}>
            <h2>¡Buen trabajo!</h2>
            <ul>
              {resumen.series.length === 0 && <li>No se contaron repeticiones esta vez.</li>}
              {resumen.series.map((s, i) => (
                <li key={i}>
                  <strong>{EJERCICIOS[s.ejercicio].nombre}:</strong> {s.ejercicio === 'plancha' ? `${s.segundos} s` : `${s.reps} repeticiones`}
                  {s.correcciones.length > 0 && <span className={styles.nota}> · Para mejorar: {s.correcciones.map((c) => c.texto.replace(/\.$/, '')).join('; ')}</span>}
                </li>
              ))}
            </ul>
            <p>
              Se guardaron <strong>{String(resumen.minutos).replace('.', ',')} min</strong> de ejercicio · 🔥 Racha: <strong>{resumen.racha} días</strong>
            </p>
            {resumen.fotos?.length > 0 && (
              <div className={styles.fotosClave}>
                {resumen.fotos.map((f, i) => (
                  <img
                    key={i}
                    src={`data:${f.media_type};base64,${f.data}`}
                    alt={`Fotograma clave ${i + 1} de la serie`}
                  />
                ))}
              </div>
            )}
            <div className={styles.acciones}>
              <button type="button" className={`${styles.boton} ${styles.primario}`} onClick={otraVez}>
                Otra serie
              </button>
              <Link href="/" className={styles.boton}>
                Volver al inicio
              </Link>
            </div>
          </Card>

          <Card titulo="Vega · Comentario y plan de hoy" acento="ia" className={styles.vegaCard}>
            {comentarioEstado === 'cargando' && (
              <p className={styles.vegaPensando} role="status" aria-live="polite">
                Analizando tu técnica y ajustando el plan de ejercicio según tu estado de salud…
              </p>
            )}

            {comentarioEstado === 'listo' && comentarioVega && (
              <>
                <p className={styles.vegaComentario}>{comentarioVega.comentario}</p>

                {comentarioVega.correccion && (
                  <p className={styles.vegaCorreccion}>
                    <strong>Técnica:</strong> {comentarioVega.correccion}
                  </p>
                )}

                <div className={styles.planAjustado}>
                  <div className={styles.planTop}>
                    <span className={styles.planEtiqueta}>Plan ajustado para hoy</span>
                    {comentarioVega.plan.limitadoPorMotor && (
                      <span className={styles.planTecho}>Limitado por tu estado de salud</span>
                    )}
                  </div>
                  <p className={styles.planValor}>
                    {comentarioVega.plan.intensidad === 'reposo'
                      ? 'Hoy toca reposo (0 min)'
                      : `${comentarioVega.plan.minutos} min · intensidad ${comentarioVega.plan.intensidad}`}
                  </p>
                  <p className={styles.planMotivo}>{comentarioVega.plan.motivo}</p>
                </div>

                {ORIGEN_COMENTARIO[comentarioVega.origen] && (
                  <p className={styles.nota}>{ORIGEN_COMENTARIO[comentarioVega.origen]}</p>
                )}
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
