'use client';

import Link from 'next/link';
import { AVISO_NO_DIAGNOSTICO } from '@/ai/cara/aviso.js';
import Card from '@/components/Card';
import { ASPECTOS_CARAS, INTENSIDAD_ETIQUETA, ZONAS_CARA } from '@/lib/cara/blendshapes';
import { useTripulanteActivo } from '@/lib/datos/tripulante';
import { rutaZona } from '@/lib/content/rutaZona';
import { SOL_ACTUAL, TRIPULANTES } from '@/lib/demo/generador';
import { useCara } from './useCara';
import styles from './CaraPantalla.module.scss';

const FATIGA_ETIQUETA = {
  normal: { texto: 'Normal', clase: 'green' },
  atencion: { texto: 'Atención', clase: 'yellow' },
  alto: { texto: 'Fatiga alta', clase: 'orange' },
};

const ORIGEN_TEXTO = {
  guardada: 'Respuesta guardada (mismas dos fotos).',
  local: 'Lectura local de parpadeo sin conexión con la IA.',
};

const MOTIVO_RPPG = {
  luz_extrema: 'Luz insuficiente o saturada; probá iluminación frontal pareja.',
  mucho_movimiento: 'Demasiado movimiento; quedate quieto frente a la cámara.',
  baja_calidad: 'Señal inestable; mirá de frente con luz uniforme.',
};

const CONFIANZA_ETIQUETA = {
  alta: 'Confianza alta',
  media: 'Confianza media',
  baja: 'Señal baja',
};

function OndaPulso({ puntos }) {
  if (!puntos || puntos.length < 3) return null;
  const w = 160;
  const h = 34;
  const d = puntos
    .map((v, i) => {
      const x = ((i / (puntos.length - 1)) * w).toFixed(1);
      const y = (h / 2 - v * (h * 0.4)).toFixed(1);
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');
  return (
    <svg className={styles.ondaPulso} viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function CaraPantalla() {
  const activoId = useTripulanteActivo();
  const nombreTripulante = TRIPULANTES.find((t) => t.id === activoId)?.name || 'Ana Ríos';
  const {
    videoRef,
    camaraEstado,
    errorCamara,
    rostroDetectado,
    segundosMedidos,
    parpadeoEnVivo,
    pulsoEnVivo,
    guardandoPulso,
    pulsoGuardado,
    fotoBase,
    fotoHoy,
    consentimiento,
    setConsentimiento,
    vozActiva,
    setVozActiva,
    analizando,
    resultado,
    avisoEnviado,
    errorAccion,
    iniciarCamara,
    apagarCamara,
    reiniciarParpadeo,
    guardarPulso,
    capturarBase,
    capturarHoy,
    subirArchivo,
    analizar,
    avisarOficial,
  } = useCara();

  const camaraActiva = camaraEstado === 'activa';
  const camaraCargando = camaraEstado === 'cargando';
  const puedeAnalizar = Boolean(consentimiento && fotoBase?.foto && fotoHoy?.foto && !analizando);

  return (
    <div className={styles.pantalla}>
      <header className={styles.encabezado}>
        <div>
          <h1>¿Cómo me ves hoy?</h1>
          <p className={styles.sub}>
            Compara tu cara de hoy con tu foto base e identifica signos de fatiga por parpadeo · Sol {SOL_ACTUAL} · {nombreTripulante}
          </p>
        </div>
        <label className={styles.vozToggle}>
          <input type="checkbox" checked={vozActiva} onChange={(e) => setVozActiva(e.target.checked)} /> Voz
        </label>
      </header>

      <p className={styles.avisoFijo} role="note">
        <strong>Aviso:</strong> {AVISO_NO_DIAGNOSTICO}
      </p>

      <div className={styles.cuerpo}>
        <Card className={styles.camaraCard}>
          <div className={styles.escena}>
            <video ref={videoRef} playsInline muted className={styles.video} hidden={!camaraActiva} />
            {!camaraActiva && (
              <div className={styles.portada}>
                <p className={styles.guia}>
                  Mirá de frente a la cámara con buena luz. En 10 segundos MediaPipe mide tu parpadeo (PERCLOS) y estima tu pulso óptico sin contacto (rPPG).
                </p>
                <button
                  type="button"
                  className={`${styles.boton} ${styles.primario}`}
                  onClick={iniciarCamara}
                  disabled={camaraCargando}
                >
                  {camaraCargando ? 'Cargando cámara y modelo facial…' : '📷 Abrir cámara'}
                </button>
                {errorCamara && <p className={styles.error} role="alert">{errorCamara}</p>}
              </div>
            )}
            {camaraActiva && (
              <div className={styles.overlay}>
                <span className={`${styles.pill} ${rostroDetectado ? styles.pillOk : styles.pillWarn}`}>
                  {rostroDetectado ? 'Rostro detectado' : 'Ubicate frente a la cámara'}
                </span>
                <span className={styles.pill}>
                  Parpadeo: {segundosMedidos} s {segundosMedidos < 10 ? '(mín. 10 s)' : '· listo ✓'}
                </span>
              </div>
            )}
          </div>

          <div className={styles.controlesCamara}>
            {camaraActiva && (
              <>
                {!fotoBase ? (
                  <button type="button" className={`${styles.boton} ${styles.primario}`} onClick={capturarBase}>
                    Guardar foto base (inicio de misión)
                  </button>
                ) : (
                  <button type="button" className={`${styles.boton} ${styles.primario}`} onClick={capturarHoy}>
                    Sacar foto de hoy
                  </button>
                )}
                {fotoBase && (
                  <button type="button" className={styles.boton} onClick={capturarBase}>
                    Actualizar foto base
                  </button>
                )}
                <button type="button" className={styles.boton} onClick={reiniciarParpadeo}>
                  Reiniciar medición
                </button>
                <button type="button" className={styles.boton} onClick={apagarCamara}>
                  Cerrar cámara
                </button>
              </>
            )}
          </div>

          {parpadeoEnVivo && (
            <div className={styles.metricasParpadeo} aria-label="Medición de parpadeo en vivo">
              <span><strong>{parpadeoEnVivo.parpadeosPorMin}</strong> parpadeos/min</span>
              <span><strong>{parpadeoEnVivo.pctOjosCerrados} %</strong> ojos cerrados (PERCLOS)</span>
              <span><strong>{parpadeoEnVivo.cierresLargos}</strong> cierres largos</span>
            </div>
          )}

          {(camaraActiva || pulsoEnVivo) && (
            <div className={styles.rppgBox} aria-label="Estimación de pulso sin contacto (rPPG)">
              <div className={styles.rppgTop}>
                <div>
                  <span className={styles.rppgTitulo}>Pulso óptico sin contacto (rPPG)</span>
                  {!pulsoEnVivo?.listo ? (
                    <p className={styles.rppgEstado}>
                      Calibrando señal de piel… {pulsoEnVivo?.duracionSeg ?? 0} s (mín. 8 s quieto con luz frontal)
                    </p>
                  ) : pulsoEnVivo.bpm != null ? (
                    <div className={styles.rppgValorFila}>
                      <strong className={styles.rppgBpm}>{pulsoEnVivo.bpm} lpm</strong>
                      <span className={`${styles.rppgBadge} ${styles[`conf_${pulsoEnVivo.confianza}`]}`}>
                        {CONFIANZA_ETIQUETA[pulsoEnVivo.confianza]} · {Math.round(pulsoEnVivo.sqi * 100)} %
                      </span>
                    </div>
                  ) : (
                    <p className={styles.rppgEstado}>
                      {MOTIVO_RPPG[pulsoEnVivo.motivo] ?? 'Esperando señal estable…'}
                      {pulsoEnVivo.sqi > 0 ? ` (SQI ${Math.round(pulsoEnVivo.sqi * 100)} %)` : ''}
                    </p>
                  )}
                </div>
                <OndaPulso puntos={pulsoEnVivo?.onda} />
              </div>

              <div className={styles.rppgPie}>
                <small className={styles.rppgNota}>
                  Estimación óptica 100 % en tu navegador; no reemplaza un oxímetro médico.
                </small>
                {pulsoEnVivo?.bpm != null && pulsoEnVivo.confianza !== 'baja' && (
                  <button
                    type="button"
                    className={`${styles.boton} ${pulsoGuardado ? styles.botonHecho : styles.primario}`}
                    onClick={guardarPulso}
                    disabled={guardandoPulso || pulsoGuardado}
                  >
                    {pulsoGuardado
                      ? `✓ Pulso guardado en Sol ${SOL_ACTUAL}`
                      : guardandoPulso
                        ? 'Guardando…'
                        : `Guardar pulso en chequeo (Sol ${SOL_ACTUAL})`}
                  </button>
                )}
              </div>
            </div>
          )}
        </Card>

        <div className={styles.lateral}>
          <Card titulo="Fotos para comparar" className={styles.fotosCard}>
            <div className={styles.comparacionGrid}>
              <div className={styles.slot}>
                <div className={styles.slotHeader}>
                  <span>Foto base</span>
                  {fotoBase?.id && <span className={styles.badgeBase} title={fotoBase.id}>Guardada</span>}
                </div>
                {fotoBase?.url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={fotoBase.url} alt="Foto base del inicio de la misión" className={styles.miniatura} />
                ) : (
                  <div className={styles.vacio}>Sin foto base</div>
                )}
                <label className={styles.subir}>
                  Subir imagen
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => subirArchivo('base', e.target.files?.[0])}
                  />
                </label>
              </div>

              <div className={styles.slot}>
                <div className={styles.slotHeader}>
                  <span>Foto de hoy</span>
                  {fotoHoy && <span className={styles.badgeHoy}>Lista</span>}
                </div>
                {fotoHoy?.url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={fotoHoy.url} alt="Foto facial de hoy" className={styles.miniatura} />
                ) : (
                  <div className={styles.vacio}>Falta foto de hoy</div>
                )}
                <label className={styles.subir}>
                  Subir imagen
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => subirArchivo('hoy', e.target.files?.[0])}
                  />
                </label>
              </div>
            </div>
          </Card>

          <Card titulo="Consentimiento y análisis" acento="ia" className={styles.consentCard}>
            <label className={styles.consentimiento}>
              <input
                type="checkbox"
                checked={consentimiento}
                onChange={(e) => setConsentimiento(e.target.checked)}
              />
              <span>
                Doy mi consentimiento para enviar estas dos fotos a la IA y comparar cambios visibles. Las fotos no se guardan en el servidor.
              </span>
            </label>

            <button
              type="button"
              className={`${styles.boton} ${styles.botonIa}`}
              onClick={analizar}
              disabled={!puedeAnalizar}
            >
              {analizando ? 'Comparando con foto base…' : '✦ Analizar cómo me ves hoy'}
            </button>

            {errorAccion && <p className={styles.error} role="alert">{errorAccion}</p>}
          </Card>
        </div>
      </div>

      {resultado && (
        <Card titulo="Observación de Vega" acento="ia" className={styles.resultadoCard}>
          <div className={styles.resultadoTop}>
            <p className={styles.resumen}>{resultado.resumen}</p>
            <p className={styles.avisoResultado}>
              <strong>{resultado.aviso ?? AVISO_NO_DIAGNOSTICO}</strong>
            </p>
          </div>

          {resultado.fatiga && (
            <div className={`${styles.fatigaBox} ${styles[FATIGA_ETIQUETA[resultado.fatiga.nivel]?.clase ?? 'green']}`}>
              <div>
                <span className={styles.fatigaNivel}>Fatiga ocular: {FATIGA_ETIQUETA[resultado.fatiga.nivel]?.texto ?? resultado.fatiga.nivel}</span>
                <p>{resultado.fatiga.mensaje}</p>
              </div>
            </div>
          )}

          {resultado.observaciones?.length > 0 && (
            <ul className={styles.observaciones}>
              {resultado.observaciones.map((o, i) => (
                <li key={`${i}-${o.aspecto}`} className={styles.observacion}>
                  <div className={styles.obsTop}>
                    <strong>{ASPECTOS_CARAS[o.aspecto] ?? o.aspecto}</strong>
                    <span className={`${styles.intensidad} ${styles[`int_${o.intensidad}`]}`}>
                      {INTENSIDAD_ETIQUETA[o.intensidad] ?? o.intensidad}
                    </span>
                  </div>
                  <p>{o.descripcion}</p>
                </li>
              ))}
            </ul>
          )}

          <div className={styles.accionBox}>
            <span className={styles.accionLabel}>Acción recomendada para hoy</span>
            <p>{resultado.accion}</p>
          </div>

          <div className={styles.resultadoPie}>
            <div className={styles.acciones}>
              {resultado.sugerirAvisoAlOficial && (
                <button
                  type="button"
                  className={`${styles.boton} ${avisoEnviado ? styles.botonHecho : styles.botonAlerta}`}
                  onClick={avisarOficial}
                  disabled={avisoEnviado}
                >
                  {avisoEnviado ? '✓ Aviso registrado al oficial médico' : '◆ Avisar al oficial médico'}
                </button>
              )}
              {resultado.zonas?.map((z) => (
                <Link key={z} href={rutaZona(z)} className={styles.boton}>
                  Ver {ZONAS_CARA[z] ?? z} en el mapa →
                </Link>
              ))}
            </div>
            {ORIGEN_TEXTO[resultado.origen] && (
              <p className={styles.nota}>{ORIGEN_TEXTO[resultado.origen]}</p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
