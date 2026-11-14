'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/Card';
import TrafficLight from '@/components/TrafficLight';
import { crearVoz } from '@/ai/vega/voz';
import {
  alternarAutoAvance,
  avanzarTransmision,
  crearRecordatoriosEnJornada,
  enviarInformeAhora,
  reiniciarEnlace,
  useEnlace,
} from '@/lib/datos/enlace';
import {
  calcularEstadoEnvio,
  RESPUESTA_MEDICA_SOL42,
  RETRASO_SOLO_IDA_MIN,
  TRADUCCION_VEGA_SOL42,
} from '@/lib/enlace/logicaEnlace';
import styles from './EnlacePantalla.module.scss';

const ICONO_HITO = {
  completado: '✓',
  activo: '▶',
  pendiente: '○',
};

export default function EnlacePantalla() {
  const enlace = useEnlace();
  const envio = calcularEstadoEnvio(enlace.iniciado ? enlace.minutosTranscurridos : null);

  const [estadoVoz, setEstadoVoz] = useState('inactivo');
  const [soportaSintesis, setSoportaSintesis] = useState(true);
  const [guardandoTareas, setGuardandoTareas] = useState(false);
  const [mensajeTareas, setMensajeTareas] = useState('');
  const vozRef = useRef(null);

  useEffect(() => {
    const voz = crearVoz({
      alCambiar: (estado) => setEstadoVoz(estado),
    });
    vozRef.current = voz;
    setSoportaSintesis(voz.soportaSintesis);
    return () => {
      voz.callar();
    };
  }, []);

  function manejarEscuchar() {
    const voz = vozRef.current;
    if (!voz) return;
    if (estadoVoz === 'hablando') {
      voz.callar();
      return;
    }
    const trad = enlace.traduccionVega ?? TRADUCCION_VEGA_SOL42;
    voz.hablar(trad.textoVoz ?? trad.resumenSimple);
  }

  function manejarReiniciar() {
    vozRef.current?.callar();
    setMensajeTareas('');
    reiniciarEnlace();
  }

  async function manejarCrearRecordatorios() {
    if (guardandoTareas) return;
    setGuardandoTareas(true);
    try {
      const resultado = await crearRecordatoriosEnJornada();
      if (resultado.creadas > 0) {
        setMensajeTareas(`Se agregaron ${resultado.creadas} recordatorios a la Jornada.`);
      } else {
        setMensajeTareas('Los 3 recordatorios de Houston ya estaban cargados en la Jornada.');
      }
    } catch {
      setMensajeTareas('No pudimos guardar los recordatorios en la base local.');
    } finally {
      setGuardandoTareas(false);
    }
  }

  const { informe } = enlace;
  const respuestaMedica = enlace.respuestaMedica ?? RESPUESTA_MEDICA_SOL42;
  const traduccionVega = enlace.traduccionVega ?? TRADUCCION_VEGA_SOL42;
  const hablando = estadoVoz === 'hablando';

  return (
    <div className={styles.pantalla}>
      <header className={styles.encabezado}>
        <div>
          <h1>Enlace con Tierra</h1>
          <p className={styles.sub}>
            Ares IV (Base Marte) ↔ Control de Misión (Houston) · Retraso de {RETRASO_SOLO_IDA_MIN} min por tramo (30 min ida y vuelta)
          </p>
        </div>
        <span className={styles.latenciaPill}>
          ⇄ Latencia actual: {RETRASO_SOLO_IDA_MIN} min solo ida
        </span>
      </header>

      <Card titulo="Informe técnico en cola · Para médicos de vuelo" acento={informe.nivel} className={styles.informeCard}>
        <div className={styles.informeTop}>
          <div className={styles.informeMeta}>
            <TrafficLight nivel={informe.nivel} />
            <span className={styles.etiquetaCola}>
              {informe.titulo}
            </span>
          </div>
          <span className={styles.origenDato}>
            {informe.origen === 'junta'
              ? 'Fuente: última Junta médica guardada'
              : 'Fuente: respaldo clínico Sol 42 (Junta médica)'}
          </span>
        </div>

        <p className={styles.resumenClinico}>{informe.resumen}</p>

        <div className={styles.tecnicoGrid}>
          <div>
            <h3>Hallazgos principales</h3>
            <ul className={styles.listaCompacta}>
              {informe.hallazgos.map((item, i) => (
                <li key={`${i}-${item.slice(0, 20)}`}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Plan propuesto a Houston</h3>
            <ul className={styles.listaCompacta}>
              {informe.plan.map((item, i) => (
                <li key={`${i}-${item.slice(0, 20)}`}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className={styles.controles}>
          <button
            type="button"
            className={styles.botonAcento}
            onClick={() => enviarInformeAhora()}
            disabled={enlace.iniciado}
          >
            📡 Transmitir a Tierra ahora
          </button>
          <button
            type="button"
            className={styles.boton}
            onClick={() => avanzarTransmision(5)}
            disabled={envio.respuestaDisponible}
          >
            ⏩ Adelantar +5 min
          </button>
          <button
            type="button"
            className={styles.boton}
            onClick={() => avanzarTransmision(envio.duracionTotalMin)}
            disabled={envio.respuestaDisponible}
          >
            ⏩ Completar recorrido
          </button>
          <button
            type="button"
            className={`${styles.boton} ${enlace.autoAvance ? styles.botonActivo : ''}`}
            onClick={() => alternarAutoAvance()}
            disabled={envio.respuestaDisponible}
            aria-pressed={enlace.autoAvance}
          >
            {enlace.autoAvance ? '⏸ Pausar auto-avance' : '▶ Auto-avance'}
          </button>
          <button
            type="button"
            className={styles.boton}
            onClick={manejarReiniciar}
            disabled={!enlace.iniciado}
          >
            ↺ Reiniciar enlace
          </button>
        </div>
      </Card>

      <Card titulo="Recorrido de la señal (14 min ida · 2 min evaluación · 14 min vuelta)" className={styles.recorridoCard}>
        <div className={styles.estadoTop}>
          <p className={styles.etapaActual} role="status">
            {envio.etiqueta}
          </p>
          <div className={styles.tiempos}>
            <span>
              Transcurrido: <strong>{envio.minutosTranscurridos}</strong> / {envio.duracionTotalMin} min
            </span>
            <span>·</span>
            <span>
              {envio.respuestaDisponible
                ? 'Respuesta disponible'
                : `Restan ${envio.minutosRestantes} min`}
            </span>
          </div>
        </div>

        <div
          className={styles.barraWrap}
          role="progressbar"
          aria-label="Progreso de transmisión con Tierra"
          aria-valuenow={envio.progresoPct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={`${styles.barraRelleno} ${envio.respuestaDisponible ? styles.barraCompleta : ''}`}
            style={{ width: `${envio.progresoPct}%` }}
          />
        </div>

        <ol className={styles.hitos}>
          {envio.hitos.map((hito) => (
            <li key={hito.id} className={`${styles.hito} ${styles[`hito_${hito.estado}`]}`}>
              <div className={styles.hitoTop}>
                <span className={styles.hitoIcono} aria-hidden="true">
                  {ICONO_HITO[hito.estado]}
                </span>
                <span className={styles.hitoMinuto}>Min {hito.minutoObjetivo}</span>
              </div>
              <span className={styles.hitoTitulo}>{hito.etiqueta}</span>
              <p className={styles.hitoDesc}>{hito.descripcion}</p>
            </li>
          ))}
        </ol>

        {!envio.respuestaDisponible && (
          <p className={styles.esperaNota}>
            {envio.etapa === 'en_cola'
              ? 'El informe técnico está listo en cola. Presioná "Transmitir a Tierra ahora" para iniciar el envío con latencia real de 14 minutos por tramo.'
              : 'La señal está en curso. Podés usar "Adelantar +5 min" o "Completar recorrido" para simular la llegada de la respuesta desde Houston.'}
          </p>
        )}
      </Card>

      {envio.respuestaDisponible && (
        <div className={styles.respuestasGrid}>
          <Card
            titulo="Bandeja de respuesta de Houston"
            acento={respuestaMedica.nivelRecomendado}
            className={styles.bandejaCard}
          >
            <div className={styles.bandejaTop}>
              <div>
                <p className={styles.remitente}>{respuestaMedica.remitente}</p>
                <h3 className={styles.asunto}>{respuestaMedica.asunto}</h3>
              </div>
              <TrafficLight nivel={respuestaMedica.nivelRecomendado} />
            </div>

            <p className={styles.resumenClinico}>{respuestaMedica.resumenTecnico}</p>

            <div>
              <h4 className={styles.subtituloBloque}>Indicaciones clínicas</h4>
              <ul className={styles.lista}>
                {(respuestaMedica.indicaciones ?? []).map((ind, i) => (
                  <li key={`${i}-${ind.slice(0, 20)}`}>{ind}</li>
                ))}
              </ul>
            </div>
          </Card>

          <Card
            titulo="✦ Traducción de Vega en lenguaje simple"
            acento="ia"
            className={styles.vegaCard}
          >
            <h3 className={styles.vegaTitulo}>{traduccionVega.titulo}</h3>
            <p className={styles.resumenClinico}>{traduccionVega.resumenSimple}</p>

            <div>
              <h4 className={styles.subtituloBloque}>Qué hacer paso a paso</h4>
              <ul className={styles.lista}>
                {(traduccionVega.pasos ?? []).map((paso, i) => (
                  <li key={`${i}-${paso.slice(0, 20)}`}>{paso}</li>
                ))}
              </ul>
            </div>

            <div className={styles.controles}>
              <button
                type="button"
                className={styles.botonIa}
                onClick={manejarEscuchar}
                disabled={!soportaSintesis}
              >
                {hablando ? '⏹ Detener explicación' : '🔊 Escuchar explicación'}
              </button>

              <button
                type="button"
                className={styles.botonAcento}
                onClick={manejarCrearRecordatorios}
                disabled={guardandoTareas}
              >
                {enlace.recordatoriosCreados
                  ? '✓ Recordatorios agregados a la Jornada'
                  : '✚ Crear recordatorios en la Jornada'}
              </button>

              {enlace.recordatoriosCreados && (
                <Link href="/jornada" className={styles.botonLink}>
                  Ver en la Jornada →
                </Link>
              )}
            </div>

            {!soportaSintesis && (
              <p className={styles.feedbackInfo}>
                Este navegador no tiene síntesis de voz disponible; podés leer los pasos arriba.
              </p>
            )}

            {mensajeTareas && <p className={styles.feedbackOk} role="status">{mensajeTareas}</p>}
          </Card>
        </div>
      )}

      <p className={styles.aviso}>
        Simulación educativa de comunicaciones Tierra–Marte con retraso de {RETRASO_SOLO_IDA_MIN} min por tramo.
      </p>
    </div>
  );
}
