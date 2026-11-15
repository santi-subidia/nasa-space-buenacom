'use client';

import Link from 'next/link';
import { AVISO_NO_DIAGNOSTICO } from '@/ai/cara/aviso.js';
import Card from '@/components/Card';
import PantallaVyta from '@/components/layout/PantallaVyta';
import { ASPECTOS_CARAS, INTENSIDAD_ETIQUETA, ZONAS_CARA } from '@/lib/cara/blendshapes';
import { useEstadoMision } from '@/lib/datos/demo';
import { rutaZona } from '@/lib/content/rutaZona';
import { useCara } from './useCara';
import styles from './CaraPantalla.module.scss';

const FATIGA_ETIQUETA = {
  normal: { texto: 'Normal', clase: 'green' },
  atencion: { texto: 'Attention', clase: 'yellow' },
  alto: { texto: 'High fatigue', clase: 'orange' },
};

const ORIGEN_TEXTO = {
  guardada: 'Saved response (same two photos).',
  local: 'Local blink reading without AI connection.',
};

const MOTIVO_RPPG = {
  luz_extrema: 'Insufficient or saturated light; try even front lighting.',
  mucho_movimiento: 'Too much movement; hold still in front of the camera.',
  baja_calidad: 'Unstable signal; face forward with uniform lighting.',
};

const CONFIANZA_ETIQUETA = {
  alta: 'High confidence',
  media: 'Medium confidence',
  baja: 'Low signal',
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
  const { activoId, astronauta, solActual, cargando } = useEstadoMision();
  const nombreTripulante = astronauta?.name || 'Crewmember';
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
    chequeoGuardado,
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
  } = useCara({ astronautId: activoId, sol: solActual });

  const camaraActiva = camaraEstado === 'activa';
  const camaraCargando = camaraEstado === 'cargando';
  const puedeAnalizar = Boolean(!cargando && astronauta && consentimiento && fotoBase?.foto && fotoHoy?.foto && !analizando);

  return (
    <PantallaVyta
      className={styles.pantalla}
      titulo="How do I look today?"
      subtitulo={`Today’s face vs. your baseline photo: blink fatigue & pulse · Sol ${solActual} · ${nombreTripulante}`}
      icono="/figma/nav-registrar.svg"
      acciones={
        <>
          <Link href="/registrar" className={styles.boton}>
            ← Check-in by sol
          </Link>
          <label className={styles.vozToggle}>
            <input type="checkbox" checked={vozActiva} onChange={(e) => setVozActiva(e.target.checked)} /> Voice
          </label>
        </>
      }
    >

      <p className={styles.avisoFijo} role="note">
        <strong>Notice:</strong> {AVISO_NO_DIAGNOSTICO}
      </p>

      <div className={styles.cuerpo}>
        <Card className={styles.camaraCard}>
          <div className={styles.escena}>
            <video ref={videoRef} playsInline muted className={styles.video} hidden={!camaraActiva} />
            {!camaraActiva && (
              <div className={styles.portada}>
                <p className={styles.guia}>
                  Look straight at the camera in good lighting. In 10 seconds MediaPipe measures your blinking (PERCLOS) and estimates contactless optical pulse (rPPG).
                </p>
                <button
                  type="button"
                  className={`${styles.boton} ${styles.primario}`}
                  onClick={iniciarCamara}
                  disabled={camaraCargando}
                >
                  {camaraCargando ? 'Loading camera and face model…' : '📷 Open camera'}
                </button>
                {errorCamara && <p className={styles.error} role="alert">{errorCamara}</p>}
              </div>
            )}
            {camaraActiva && (
              <div className={styles.overlay}>
                <span className={`${styles.pill} ${rostroDetectado ? styles.pillOk : styles.pillWarn}`}>
                  {rostroDetectado ? 'Face detected' : 'Center yourself in front of the camera'}
                </span>
                <span className={styles.pill}>
                  Blinking: {segundosMedidos} s {segundosMedidos < 10 ? '(min 10 s)' : '· ready ✓'}
                </span>
              </div>
            )}
          </div>

          <div className={styles.controlesCamara}>
            {camaraActiva && (
              <>
                {!fotoBase ? (
                  <button type="button" className={`${styles.boton} ${styles.primario}`} onClick={capturarBase}>
                    Save baseline photo (mission start)
                  </button>
                ) : (
                  <button type="button" className={`${styles.boton} ${styles.primario}`} onClick={capturarHoy}>
                    Take today’s photo
                  </button>
                )}
                {fotoBase && (
                  <button type="button" className={styles.boton} onClick={capturarBase}>
                    Update baseline photo
                  </button>
                )}
                <button type="button" className={styles.boton} onClick={reiniciarParpadeo}>
                  Reset measurement
                </button>
                <button type="button" className={styles.boton} onClick={apagarCamara}>
                  Close camera
                </button>
              </>
            )}
          </div>

          {parpadeoEnVivo && (
            <div className={styles.metricasParpadeo} aria-label="Live blink measurement">
              <span><strong>{parpadeoEnVivo.parpadeosPorMin}</strong> blinks/min</span>
              <span><strong>{parpadeoEnVivo.pctOjosCerrados} %</strong> eyes closed (PERCLOS)</span>
              <span><strong>{parpadeoEnVivo.cierresLargos}</strong> long closures</span>
            </div>
          )}

          {(camaraActiva || pulsoEnVivo) && (
            <div className={styles.rppgBox} aria-label="Contactless pulse estimation (rPPG)">
              <div className={styles.rppgTop}>
                <div>
                  <span className={styles.rppgTitulo}>Contactless optical pulse (rPPG)</span>
                  {!pulsoEnVivo?.listo ? (
                    <p className={styles.rppgEstado}>
                      Calibrating skin signal… {pulsoEnVivo?.duracionSeg ?? 0} s (min 8 s still with front lighting)
                    </p>
                  ) : pulsoEnVivo.bpm != null ? (
                    <div className={styles.rppgValorFila}>
                      <strong className={styles.rppgBpm}>{pulsoEnVivo.bpm} bpm</strong>
                      <span className={`${styles.rppgBadge} ${styles[`conf_${pulsoEnVivo.confianza}`]}`}>
                        {CONFIANZA_ETIQUETA[pulsoEnVivo.confianza]} · {Math.round(pulsoEnVivo.sqi * 100)} %
                      </span>
                    </div>
                  ) : (
                    <p className={styles.rppgEstado}>
                      {MOTIVO_RPPG[pulsoEnVivo.motivo] ?? 'Waiting for stable signal…'}
                      {pulsoEnVivo.sqi > 0 ? ` (SQI ${Math.round(pulsoEnVivo.sqi * 100)} %)` : ''}
                    </p>
                  )}
                </div>
                <OndaPulso puntos={pulsoEnVivo?.onda} />
              </div>

              <div className={styles.rppgPie}>
                <small className={styles.rppgNota}>
                  100% browser optical estimate; does not replace a medical oximeter.
                </small>
                {pulsoEnVivo?.bpm != null && pulsoEnVivo.confianza !== 'baja' && (
                  <button
                    type="button"
                    className={`${styles.boton} ${pulsoGuardado ? styles.botonHecho : styles.primario}`}
                    onClick={guardarPulso}
                    disabled={guardandoPulso || pulsoGuardado}
                  >
                    {pulsoGuardado
                      ? `✓ Pulse saved on Sol ${solActual}`
                      : guardandoPulso
                        ? 'Saving…'
                        : `Save pulse to check-in (Sol ${solActual})`}
                  </button>
                )}
              </div>
            </div>
          )}
        </Card>

        <div className={styles.lateral}>
          <Card titulo="Photos to compare" className={styles.fotosCard}>
            <div className={styles.comparacionGrid}>
              <div className={styles.slot}>
                <div className={styles.slotHeader}>
                  <span>Baseline photo</span>
                  {fotoBase?.id && <span className={styles.badgeBase} title={fotoBase.id}>Saved</span>}
                </div>
                {fotoBase?.url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={fotoBase.url} alt="Mission-start baseline photo" className={styles.miniatura} />
                ) : (
                  <div className={styles.vacio}>No baseline photo</div>
                )}
              </div>

              <div className={styles.slot}>
                <div className={styles.slotHeader}>
                  <span>Today’s photo</span>
                  {fotoHoy && <span className={styles.badgeHoy}>Ready</span>}
                </div>
                {fotoHoy?.url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={fotoHoy.url} alt="Today’s facial photo" className={styles.miniatura} />
                ) : (
                  <div className={styles.vacio}>Missing today’s photo</div>
                )}
              </div>
            </div>
          </Card>

          <Card titulo="Consent & analysis" acento="ia" className={styles.consentCard}>
            <label className={styles.consentimiento}>
              <input
                type="checkbox"
                checked={consentimiento}
                onChange={(e) => setConsentimiento(e.target.checked)}
              />
              <span>
                I consent to sending these two photos to the AI to compare visible changes. Photos are not stored on the server.
              </span>
            </label>

            <button
              type="button"
              className={`${styles.boton} ${styles.botonIa}`}
              onClick={analizar}
              disabled={!puedeAnalizar}
            >
              {analizando ? 'Comparing with baseline photo…' : '✦ Analyze how I look today'}
            </button>

            {errorAccion && <p className={styles.error} role="alert">{errorAccion}</p>}
          </Card>
        </div>
      </div>

      {resultado && (
        <Card titulo="Vyta’s observation" acento="ia" className={styles.resultadoCard}>
          {chequeoGuardado && <p role="status">✓ Facial check-in completed for Sol {solActual}. <Link href="/registrar">Continue check-in →</Link></p>}
          <div className={styles.resultadoTop}>
            <p className={styles.resumen}>{resultado.resumen}</p>
            <p className={styles.avisoResultado}>
              <strong>{resultado.aviso ?? AVISO_NO_DIAGNOSTICO}</strong>
            </p>
          </div>

          {resultado.fatiga && (
            <div className={`${styles.fatigaBox} ${styles[FATIGA_ETIQUETA[resultado.fatiga.nivel]?.clase ?? 'green']}`}>
              <div>
                <span className={styles.fatigaNivel}>Eye fatigue: {FATIGA_ETIQUETA[resultado.fatiga.nivel]?.texto ?? resultado.fatiga.nivel}</span>
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
            <span className={styles.accionLabel}>Recommended action for today</span>
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
                  {avisoEnviado ? '✓ Medical officer notification logged' : '◆ Notify medical officer'}
                </button>
              )}
              {resultado.zonas?.map((z) => (
                <Link key={z} href={rutaZona(z)} className={styles.boton}>
                  View {ZONAS_CARA[z] ?? z} on map →
                </Link>
              ))}
            </div>
            {ORIGEN_TEXTO[resultado.origen] && (
              <p className={styles.nota}>{ORIGEN_TEXTO[resultado.origen]}</p>
            )}
          </div>
        </Card>
      )}
    </PantallaVyta>
  );
}
