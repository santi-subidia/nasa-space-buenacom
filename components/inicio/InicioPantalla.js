'use client';

import { useState } from 'react';
import Link from 'next/link';
import Card from '@/components/Card';
import TrafficLight from '@/components/TrafficLight';
import {
  SOL_ACTUAL,
  accionReiniciarDemo,
  accionSincronizarWatch,
  useEstadoMision,
} from '@/lib/datos/demo';
import { usePermisosCompartir } from '@/lib/datos/tripulante';
import { armarVistaOficialMedico } from '@/lib/tripulacion/logicaTripulante';
import { minutosHoy } from '@/lib/entrenador/racha';
import { MISION } from '@/lib/mock/mision';
import { TARJETAS, CHEQUEO, valoresDelDia, nivelDeTarjeta } from '@/lib/mock/indicadores';
import styles from './InicioPantalla.module.scss';

export default function InicioPantalla() {
  const {
    activoId,
    astronauta,
    tripulacion,
    lecturas,
    watchSincronizadoHoy,
    evaluacion,
    evaluacionAna,
    evaluacionMarcos,
  } = useEstadoMision(null, SOL_ACTUAL);
  const permisos = usePermisosCompartir();

  const [ocupado, setOcupado] = useState(false);
  const [avisoDemo, setAvisoDemo] = useState('');

  const vals = valoresDelDia(lecturas, SOL_ACTUAL);
  const tarjetas = TARJETAS.map((t) => ({
    ...t,
    nivel: evaluacion.indicatorLevels?.[t.claves[0]] ?? nivelDeTarjeta(t, vals),
  }));
  const nivelGeneral = evaluacion.globalLevel || 'green';
  const chequeo = CHEQUEO.map((c) => ({ ...c, hecho: c.claves.every((k) => vals[k]?.hoy) }));
  const hechos = chequeo.filter((c) => c.hecho).length;
  const vistaCmo = activoId === 'marcos'
    ? armarVistaOficialMedico({
        tripulacion,
        evaluacionesPorId: { ana: evaluacionAna, marcos: evaluacionMarcos },
        permisosPorId: permisos,
      })
    : null;

  async function manejarSyncWatch() {
    setOcupado(true);
    setAvisoDemo('');
    try {
      await accionSincronizarWatch(SOL_ACTUAL, activoId);
      setAvisoDemo(`Watch sincronizado para ${astronauta?.name || activoId} (watch_sim · sol ${SOL_ACTUAL}).`);
    } catch (err) {
      console.error(err);
      setAvisoDemo('No se pudo sincronizar el Watch.');
    } finally {
      setOcupado(false);
    }
  }

  async function manejarReiniciar() {
    setOcupado(true);
    setAvisoDemo('');
    try {
      await accionReiniciarDemo();
      setAvisoDemo('Demo reiniciada con los 60 soles iniciales.');
    } catch (err) {
      console.error(err);
      setAvisoDemo('No se pudo reiniciar la demo.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className={styles.pantalla}>
      <Encabezado
        nombre={astronauta?.name || MISION.astronauta.nombre}
        nivelMarcos={evaluacionMarcos?.globalLevel || 'green'}
        watchSincronizadoHoy={watchSincronizadoHoy}
        ocupado={ocupado}
        onSyncWatch={manejarSyncWatch}
        onReiniciar={manejarReiniciar}
        avisoDemo={avisoDemo}
      />

      <div className={styles.fila}>
        <EstadoGeneral nivel={nivelGeneral} alertas={evaluacion.alerts || []} vistaCmo={vistaCmo} />
        <Chequeo items={chequeo} hechos={hechos} />
      </div>

      <section aria-label="Indicadores de hoy" className={styles.indicadores}>
        {tarjetas.map((t) => (
          <TarjetaIndicador key={t.id} tarjeta={t} vals={vals} />
        ))}
      </section>

      <div className={styles.fila}>
        <Racha ejercicioHoy={minutosHoy(lecturas, SOL_ACTUAL) > 0} />
        <BarraVega />
      </div>
    </div>
  );
}

function Encabezado({
  nombre,
  nivelMarcos,
  watchSincronizadoHoy,
  ocupado,
  onSyncWatch,
  onReiniciar,
  avisoDemo,
}) {
  return (
    <header className={styles.encabezado}>
      <div>
        <h1>Buen día, {nombre}</h1>
        <p className={styles.sub}>
          Sol {SOL_ACTUAL} de 60 · {MISION.entorno}
        </p>
        {avisoDemo && <p className={styles.avisoAccion} role="status">{avisoDemo}</p>}
      </div>
      <div className={styles.chips}>
        <span className={styles.chip} title="Estado del oficial médico de la tripulación">
          <TrafficLight nivel={nivelMarcos} conTexto={false} /> Marcos (CMO): <strong>todo verde</strong>
        </span>
        <span className={styles.chip} title="Tiempo que tarda un mensaje en llegar a la Tierra">
          ⏱ Retraso con Tierra: <strong>{MISION.retrasoMin} min</strong>
        </span>
        <button
          type="button"
          className={styles.chipBoton}
          onClick={onSyncWatch}
          disabled={ocupado}
        >
          ⌚ {watchSincronizadoHoy ? 'Re-sincronizar Watch' : 'Sincronizar Watch'}
        </button>
        <button
          type="button"
          className={`${styles.chipBoton} ${styles.chipSecundario}`}
          onClick={onReiniciar}
          disabled={ocupado}
        >
          ↺ Reiniciar demo
        </button>
      </div>
    </header>
  );
}

function EstadoGeneral({ nivel, alertas, vistaCmo }) {
  const principal = alertas[0] || null;
  const extras = Math.max(0, alertas.length - 1);

  return (
    <Card titulo="Estado general" acento={nivel} className={styles.estado}>
      <div className={styles.estadoNivel}>
        <TrafficLight nivel={nivel} />
      </div>

      {principal ? (
        <div className={styles.alerta}>
          <h3>
            <TrafficLight nivel={principal.level} conTexto={false} /> {principal.title}
          </h3>
          <p>{principal.why}</p>
          <ul>
            {(principal.actions || []).map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <p className={styles.fuente}>
            Fuente: {principal.nasaSource}
            {extras > 0 ? ` · +${extras} aviso(s) adicional(es)` : ''}
          </p>
        </div>
      ) : (
        <div className={styles.alerta}>
          <h3>
            <TrafficLight nivel="green" conTexto={false} /> Todo dentro de los valores esperados
          </h3>
          <p>Tus mediciones y síntomas recientes no disparan alertas en el motor de reglas.</p>
        </div>
      )}

      {vistaCmo && (
        <div className={styles.alerta} style={{ marginTop: 12 }}>
          <h3>Vista del oficial médico (CMO)</h3>
          <ul>
            {vistaCmo.map((c) => (
              <li key={c.id}>
                <TrafficLight nivel={c.level} conTexto={false} /> <strong>{c.name}:</strong>{' '}
                {c.alertaActiva ? c.alertaActiva.title : 'Todo en verde'}
                {!c.compartioDetalles ? ' · mediciones detalladas privadas' : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.botones}>
        <Link className={styles.boton} href={`/mapa?zona=${principal?.zone || 'immune'}`}>
          Ver guía
        </Link>
        <Link className={styles.boton} href="/enlace">
          Avisar al oficial médico
        </Link>
        <Link className={`${styles.boton} ${styles.botonIa}`} href="/junta">
          Convocar junta médica
        </Link>
        {vistaCmo && (
          <Link className={styles.boton} href="/tripulacion">
            Panel CMO / Privacidad
          </Link>
        )}
      </div>
    </Card>
  );
}

function Chequeo({ items, hechos }) {
  const completo = hechos === items.length;
  return (
    <Card titulo="Chequeo matutino" className={styles.chequeo}>
      <p className={styles.progreso}>
        {hechos} de {items.length} {completo && '· ¡listo por hoy!'}
      </p>
      <div
        className={styles.barra}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={items.length}
        aria-valuenow={hechos}
      >
        <span style={{ width: `${(hechos / items.length) * 100}%` }} />
      </div>
      <ul className={styles.lista}>
        {items.map((c) => (
          <li key={c.id} className={c.hecho ? styles.hecho : undefined}>
            <span aria-hidden="true">{c.hecho ? '☑' : '☐'}</span> {c.etiqueta}
            <span className={styles.oculto}>{c.hecho ? ' (hecho)' : ' (pendiente)'}</span>
          </li>
        ))}
      </ul>
      {!completo && (
        <Link className={`${styles.boton} ${styles.botonAcento}`} href="/registrar">
          Completar chequeo
        </Link>
      )}
    </Card>
  );
}

function TarjetaIndicador({ tarjeta, vals }) {
  const { nombre, unidad, claves, formato, nivel } = tarjeta;
  const valor = formato(claves.map((k) => vals[k].valor));
  const hoy = claves.every((k) => vals[k].hoy);
  const notaWatch = claves.map((k) => vals[k].note).find(Boolean);
  return (
    <Card acento={nivel} className={styles.indicador}>
      <div className={styles.indicadorTop}>
        <span className={styles.nombre}>{nombre}</span>
        <TrafficLight nivel={nivel} />
      </div>
      <p className={styles.valor}>
        {valor} <small>{unidad}</small>
      </p>
      {!hoy && <p className={styles.ayer}>último dato (ayer)</p>}
      {hoy && notaWatch && <p className={styles.ayer}>{notaWatch}</p>}
    </Card>
  );
}

function Racha({ ejercicioHoy }) {
  const { total } = MISION.tripulacion;
  const conEjercicioHoy = MISION.tripulacion.conEjercicioHoy + (ejercicioHoy ? 1 : 0);
  const racha = MISION.rachaEjercicio + (ejercicioHoy ? 1 : 0);
  return (
    <Card className={styles.racha}>
      <p>
        🔥 Racha de ejercicio: <strong>{racha} días</strong>
      </p>
      <p className={styles.sub}>
        Meta de la tripulación: {conEjercicioHoy} de {total} ya entrenaron hoy
      </p>
      <div className={styles.barra}>
        <span style={{ width: `${(conEjercicioHoy / total) * 100}%` }} />
      </div>
    </Card>
  );
}

function BarraVega() {
  return (
    <Link href="/vega" className={styles.vega} aria-label="Hablar con Vega">
      <span className={styles.vegaIcono} aria-hidden="true">✦</span>
      <span className={styles.vegaTexto}>Preguntale a Vega o contale cómo te sentís…</span>
      <span className={styles.vegaMic} aria-hidden="true">🎙</span>
    </Link>
  );
}
