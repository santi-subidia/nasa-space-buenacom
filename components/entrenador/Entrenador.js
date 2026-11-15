'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { crearComentarioDeSerie } from '@/ai/entrenador/serie.js';
import { crearVoz } from '@/ai/vega/voz.js';
import Card from '@/components/Card';
import CabeceraMision from '@/components/layout/CabeceraMision';
import EjerciciosPendientes from '@/components/actividad/EjerciciosPendientes';
import { useJornada } from '@/lib/datos/jornada';
import { TARJETAS_RESUMEN, nivelDeTarjetaDb, valoresDelDia } from '@/lib/datos/indicadores';
import { EJERCICIOS, crearEntrenamiento } from '@/lib/entrenador/ejercicios';
import { rachaEjercicio } from '@/lib/entrenador/racha';
import { armarPayloadSerie } from '@/lib/entrenador/resumen';
import { guardarLecturas, leerLecturas, useLecturas } from '@/lib/datos/lecturas';
import { leerSintomas } from '@/lib/datos/sintomas';
import { silenciarLogsMediaPipe } from '@/lib/mediapipe/silenciarLogs';
import { evaluate } from '@/lib/motor/evaluar';
import { maxNivel } from '@/lib/niveles';
import styles from './Entrenador.module.scss';

// WASM: lo copia `npm install` a public/mediapipe/wasm. Modelo: por defecto del CDN de Google;
// para trabajar sin conexión, bajar el .task a public/mediapipe/ y apuntar la variable de entorno.
const WASM = '/mediapipe/wasm';
const MODELO =
  process.env.NEXT_PUBLIC_POSE_MODEL_URL ||
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

const TEXTO_FASE = { inicio: 'Get into position', arriba: 'Up', bajando: 'Lowering', abajo: 'Bottom', subiendo: 'Rising', sosteniendo: 'Hold', corregir: 'Fix your form', fuera: 'Get into plank' };
const MAX_FOTOS = 3;
const MAX_CARACTERES_FOTO = 2_500_000;

const ETIQUETA_INTENSIDAD = {
  normal: 'normal',
  moderada: 'moderate',
  liviana: 'light',
  reposo: 'rest',
};

const ORIGEN_COMENTARIO = {
  guardada: 'Saved AI response',
  local: 'Local feedback using your metrics from this set (no AI connection)',
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
  const { astronauta, sol: solActual, diaSemana, planEjercicios, tareas, cargando: cargandoMision } = useJornada();
  const lecturasRef = useRef(lecturas);
  lecturasRef.current = lecturas;
  const solActivoRef = useRef(solActual);
  solActivoRef.current = solActual;
  const astronautaRef = useRef(astronauta);
  astronautaRef.current = astronauta;
  const seleccionManualRef = useRef(false);

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
    const param = new URLSearchParams(window.location.search).get('ejercicio');
    if (param && EJERCICIOS[param]) {
      seleccionManualRef.current = true;
      setEjercicio(param);
    }
    vozVegaRef.current = crearVoz();
    return () => {
      comentarioIdRef.current += 1;
      vozVegaRef.current?.callar();
    };
  }, []);

  useEffect(() => {
    if (cargandoMision || pantalla !== 'reposo' || seleccionManualRef.current) return;
    const recomendado = planEjercicios?.pendientes?.[0]?.id || planEjercicios?.sugeridos?.[0]?.id;
    if (recomendado && EJERCICIOS[recomendado]) {
      setEjercicio(recomendado);
    }
  }, [cargandoMision, pantalla, planEjercicios]);

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
    u.lang = 'en-US';
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
      silenciarLogsMediaPipe();
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
      hablar(`${EJERCICIOS[ejercicio].nombre}. Start whenever you’re ready.`);
      bucle(PoseLandmarker.POSE_CONNECTIONS);
    } catch (e) {
      apagar();
      setPantalla('error');
      setError(
        e?.name === 'NotAllowedError'
          ? 'Camera permission is denied. Enable it in your browser and try again.'
          : e?.name === 'NotFoundError'
            ? 'No camera found.'
            : `Could not start the trainer (${e?.message ?? 'unknown error'}). Check your connection: the model downloads on first use.`,
      );
    }
  }

  // Cambiar de ejercicio guarda lo hecho en la serie y arranca un contador nuevo.
  function cambiar(id, { manual = true } = {}) {
    if (!EJERCICIOS[id]) return;
    if (manual) seleccionManualRef.current = true;
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

    const solObjetivo = solActivoRef.current ?? 42;
    const baselineActual = astronautaRef.current?.baseline || {};
    const ejerciciosRealizados = {};
    for (const s of series) {
      const cantidad = s.ejercicio === 'plancha' ? s.segundos : s.reps;
      ejerciciosRealizados[s.ejercicio] = (ejerciciosRealizados[s.ejercicio] || 0) + cantidad;
    }
    const nota = series
      .map((s) => `${s.ejercicio === 'plancha' ? `${s.segundos} s de plancha` : `${s.reps} ${EJERCICIOS[s.ejercicio].nombre.toLowerCase()}`}`)
      .join(', ');
    let guardado = true;
    try {
      await guardarLecturas([{
        indicator: 'exercise_min',
        value: minutos,
        sol: solObjetivo,
        source: 'camera',
        note: nota || `${EJERCICIOS[ejercicio].nombre}: sin repeticiones`,
        meta: {
          ejercicios: Object.keys(ejerciciosRealizados).length ? ejerciciosRealizados : [ejercicio],
        },
      }]);
    } catch (err) {
      console.error(err);
      guardado = false;
    }

    const idPedido = ++comentarioIdRef.current;
    let lecturasActuales = lecturasRef.current;
    let sintomasActuales = [];
    try {
      [lecturasActuales, sintomasActuales] = await Promise.all([leerLecturas(), leerSintomas()]);
    } catch {
      /* si IndexedDB falla, seguimos con las lecturas ya cargadas */
    }
    const racha = rachaEjercicio(lecturasActuales, solObjetivo);
    setResumen({ series, minutos, racha, fotos, guardado });
    setComentarioVega(null);
    setComentarioEstado('cargando');
    setPantalla('resumen');
    const vals = valoresDelDia(lecturasActuales, solObjetivo);
    const ev = evaluate(lecturasActuales, baselineActual, 'mars_base', { symptoms: sintomasActuales, sol: solObjetivo });
    const nivelMotor = maxNivel(TARJETAS_RESUMEN.map((t) => nivelDeTarjetaDb(t, vals, baselineActual)), ev.globalLevel);
    const payload = armarPayloadSerie({
      series,
      ejercicioActual: ejercicio,
      minutos,
      anguloMin,
      fotos,
      vals,
      nivelMotor,
      alertaTitulo: ev.alerts[0]?.title || null,
    });
    payload.diaSemana = diaSemana || 'jueves';
    payload.estado = {
      ...payload.estado,
      alertas: ev.alerts.map((a) => a.id).filter(Boolean),
    };
    if (planEjercicios && Number.isFinite(planEjercicios.minutosObjetivo)) {
      payload.planActual = {
        minutos: planEjercicios.minutosObjetivo,
        intensidad: planEjercicios.intensidad,
      };
    }

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
  const ejercicios = Object.values(EJERCICIOS);
  const indiceEjercicio = ejercicios.findIndex((x) => x.id === ejercicio);
  const metaPlan = planEjercicios?.sugeridos?.find((x) => x.id === ejercicio)?.meta;
  const metaObjetivo = metaPlan > 0 ? metaPlan : (esPlancha ? 30 : 15);
  const valorActualContador = esPlancha ? estado.segundos : estado.reps;

  return (
    <div className={styles.pantalla} data-dashboard>
      <CabeceraMision nombre={astronauta?.name} titulo={astronauta?.titulo} sol={solActual} />
      <h1 className={styles.oculto}>Activity / Physical exercises</h1>

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
                  {pantalla === 'cargando' ? 'Loading camera and model…' : '📷 Start with camera'}
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

          <aside className={styles.lado} aria-label="Current workout">
            <div className={styles.pasoCabecera}><p>Exercise {indiceEjercicio + 1} of {ejercicios.length}</p><Link href="/actividad" aria-label="Back to activity selection" title="Back to Activity">↩</Link></div>
            <div className={styles.ejercicios} role="radiogroup" aria-label="Choose exercise">
              {ejercicios.map((x, i) => <button key={x.id} type="button" role="radio" aria-checked={ejercicio === x.id}
                aria-label={`${i + 1}. ${x.nombre}`} title={x.nombre} className={ejercicio === x.id ? styles.activo : ''}
                onClick={() => cambiar(x.id)} disabled={pantalla === 'cargando'}><span className={styles.oculto}>{x.nombre}</span></button>)}
            </div>
            <h2 className={styles.nombreEjercicio}>{e.nombre}</h2>
            <section className={styles.panelContador} aria-label={`${e.nombre} counter`}>
              <p className={styles.contador} aria-live="polite" aria-atomic="true">{valorActualContador}{metaObjetivo ? <span> / {metaObjetivo}</span> : null}</p>
              <p className={styles.unidadContador}>{esPlancha ? 'Seconds' : 'Reps'}</p>
              <div className={styles.progresoContador} aria-hidden="true"><span style={{ width: metaObjetivo ? `${Math.min(100, (valorActualContador / metaObjetivo) * 100)}%` : '0%' }} /></div>
            </section>
            <EjerciciosPendientes
              tareas={tareas}
              planEjercicios={planEjercicios}
              diaSemana={diaSemana}
              cargando={cargandoMision}
              entrenamiento
              onSeleccionarEjercicio={(id) => cambiar(id)}
              ejercicioActivo={ejercicio}
            >
              <div className={styles.controles}>
                <p className={styles.fase} role="status">{activo ? TEXTO_FASE[estado.fase] ?? estado.fase : pantalla === 'cargando' ? 'Preparing camera…' : 'Waiting for camera'}</p>
                {activo && estado.angulo !== null && <p className={styles.dato}>Angle: {estado.angulo}°</p>}
                {activo && !estado.valido && <p className={styles.dato}>Can’t see you clearly: stand sideways.</p>}
                <label className={styles.voz}><input type="checkbox" checked={voz} onChange={(ev) => setVoz(ev.target.checked)} /> Voice cues</label>
                <button type="button" className={`${styles.boton} ${styles.primario}`} onClick={terminar} disabled={!activo}>Finish & save</button>
                <p className={styles.nota}>Exercise minutes from this session are saved.</p>
              </div>
            </EjerciciosPendientes>
          </aside>
        </div>
      )}

      {pantalla === 'resumen' && resumen && (
        <div className={styles.resumenGrid}>
          <Card titulo="Summary" acento="green" className={styles.resumen}>
            <h2>Great work!</h2>
            <ul>
              {resumen.series.length === 0 && <li>No reps counted this time.</li>}
              {resumen.series.map((s, i) => (
                <li key={i}>
                  <strong>{EJERCICIOS[s.ejercicio].nombre}:</strong> {s.ejercicio === 'plancha' ? `${s.segundos} s` : `${s.reps} reps`}
                  {s.correcciones.length > 0 && <span className={styles.nota}> · To improve: {s.correcciones.map((c) => c.texto.replace(/\.$/, '')).join('; ')}</span>}
                </li>
              ))}
            </ul>
            {!resumen.guardado && <p className={styles.error} role="alert">Could not save the exercise on this device.</p>}
            <p>
              Saved <strong>{String(resumen.minutos)} min</strong> of exercise · 🔥 Streak: <strong>{resumen.racha} days</strong>
            </p>
            {resumen.fotos?.length > 0 && (
              <div className={styles.fotosClave}>
                {resumen.fotos.map((f, i) => (
                  <img
                    key={i}
                    src={`data:${f.media_type};base64,${f.data}`}
                    alt={`Key frame ${i + 1} from the set`}
                  />
                ))}
              </div>
            )}
            <div className={styles.acciones}>
              <button type="button" className={`${styles.boton} ${styles.primario}`} onClick={otraVez}>
                Another set
              </button>
              <Link href="/" className={styles.boton}>
                Back to home
              </Link>
              <label className={styles.voz}><input type="checkbox" checked={voz} onChange={(ev) => setVoz(ev.target.checked)} /> Voice</label>
            </div>
          </Card>

          <Card titulo="Vega · Feedback & today’s plan" acento="ia" className={styles.vegaCard}>
            {comentarioEstado === 'cargando' && (
              <p className={styles.vegaPensando} role="status" aria-live="polite">
                Analyzing your form and adjusting today’s exercise plan based on your health status…
              </p>
            )}

            {comentarioEstado === 'listo' && comentarioVega && (
              <>
                <p className={styles.vegaComentario}>{comentarioVega.comentario}</p>

                {comentarioVega.correccion && (
                  <p className={styles.vegaCorreccion}>
                    <strong>Form:</strong> {comentarioVega.correccion}
                  </p>
                )}

                <div className={styles.planAjustado}>
                  <div className={styles.planTop}>
                    <span className={styles.planEtiqueta}>Adjusted plan for today</span>
                    {comentarioVega.plan.limitadoPorMotor && (
                      <span className={styles.planTecho}>Limited by your health status</span>
                    )}
                  </div>
                  <p className={styles.planValor}>
                    {comentarioVega.plan.intensidad === 'reposo'
                      ? 'Today is a rest day (0 min)'
                      : `${comentarioVega.plan.minutos} min · ${ETIQUETA_INTENSIDAD[comentarioVega.plan.intensidad] || comentarioVega.plan.intensidad} intensity`}
                  </p>
                  <p className={styles.planMotivo}>{comentarioVega.plan.motivo}</p>
                  {comentarioVega.plan.ejerciciosSugeridos?.length > 0 && (
                    <div className={styles.sugeridosBloque}>
                      <span className={styles.planEtiqueta}>Suggested exercises</span>
                      <div className={styles.sugeridosLista}>
                        {comentarioVega.plan.ejerciciosSugeridos
                          .filter((id) => EJERCICIOS[id])
                          .map((id) => (
                            <button
                              key={id}
                              type="button"
                              className={styles.chipSugerido}
                              onClick={() => {
                                cambiar(id);
                                otraVez();
                              }}
                            >
                              {EJERCICIOS[id].nombre}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
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
