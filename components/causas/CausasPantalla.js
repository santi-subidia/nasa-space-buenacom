'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Card from '@/components/Card';
import TrafficLight from '@/components/TrafficLight';
import { GRAFOS, TIPOS_NODO, alertaConGrafo, armarGrafoCausal } from '@/lib/causas/grafos';
import { SOL_ACTUAL, useEstadoMision } from '@/lib/datos/demo';
import GrafoCausal from './GrafoCausal';
import styles from './Causas.module.scss';

const REPO = 'https://github.com/santi-subidia/nasa-space-buenacom/blob/main/';

export default function CausasPantalla() {
  const { cargando, sintomas, evaluacion } = useEstadoMision(null, SOL_ACTUAL);
  const pedida = useSearchParams().get('alerta');
  const alertaId = GRAFOS[pedida] ? pedida : alertaConGrafo(evaluacion)?.ruleId || 'viral_reactivation';
  const grafo = armarGrafoCausal(alertaId, { evaluacion, sintomas, sol: SOL_ACTUAL });
  const { alerta } = grafo;

  return (
    <div className={styles.pantalla}>
      <header className={styles.encabezado}>
        <div>
          <h1>{grafo.titulo}</h1>
          <p className={styles.sub}>
            Sol {SOL_ACTUAL} · camino causal tomado del grafo oficial de la NASA (Human System Risk Board)
          </p>
        </div>
        {alerta && <TrafficLight nivel={alerta.level} />}
      </header>

      <Card>
        <p className={styles.resumen}>{grafo.resumen}</p>
        {cargando ? (
          <p className={styles.aviso} role="status">
            Leyendo las mediciones de este equipo…
          </p>
        ) : (
          <>
            {!alerta && (
              <p className={styles.aviso} role="status">
                Hoy esta alerta no está activa: el grafo muestra la cadena, pero ningún eslabón medido la dispara.
              </p>
            )}
            <GrafoCausal grafo={grafo} />
          </>
        )}
        <ul className={styles.leyenda} aria-label="Tipos de nodo">
          {Object.entries(TIPOS_NODO).map(([k, texto]) => (
            <li key={k}>
              <span className={`${styles.muestra} ${styles[k]}`} aria-hidden="true" /> {texto}
            </li>
          ))}
          <li>
            <span className={styles.lineaActiva} aria-hidden="true" /> Camino encendido hoy
          </li>
        </ul>
      </Card>

      <div className={styles.fila}>
        <Card titulo="Qué midió AstroVitals">
          {cargando ? null : alerta ? (
            <>
              <p className={styles.texto}>{alerta.why}</p>
              <ol className={styles.pasos}>
                {grafo.camino.map((paso) => (
                  <li key={paso}>{paso}</li>
                ))}
              </ol>
            </>
          ) : (
            <p className={styles.texto}>Sin alerta activa para esta cadena.</p>
          )}
        </Card>

        <Card titulo="Dónde se puede cortar la cadena">
          <ul className={styles.pasos}>
            {(alerta?.actions || []).map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          <p className={styles.texto}>
            Dormir y bajar el estrés actúan sobre los primeros eslabones; avisar al oficial médico activa la capacidad de
            tratar a bordo antes de una tarea crítica.
          </p>
        </Card>
      </div>

      <p className={styles.fuente}>
        Fuente: <a href={grafo.dag.url} target="_blank" rel="noreferrer">{grafo.dag.nombre} (PDF)</a> · transcripción en{' '}
        <a href={`${REPO}${grafo.dag.local}`} target="_blank" rel="noreferrer">
          {grafo.dag.local}
        </a>
        . Se muestran 12 de los 49 nodos del DAG: los que AstroVitals puede medir o explicar. Orienta, no diagnostica.
      </p>

      <div className={styles.botones}>
        <Link className={styles.boton} href="/">
          Volver a Inicio
        </Link>
        <Link className={styles.boton} href={`/mapa?zona=${alerta?.zone || 'immune'}`}>
          Ver en el mapa corporal
        </Link>
        <Link className={`${styles.boton} ${styles.ia}`} href="/junta">
          Convocar junta médica
        </Link>
      </div>
    </div>
  );
}
