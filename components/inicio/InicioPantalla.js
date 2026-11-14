'use client';

import Link from 'next/link';
import Card from '@/components/Card';
import TrafficLight from '@/components/TrafficLight';
import { maxNivel } from '@/lib/niveles';
import { useLecturas } from '@/lib/datos/lecturas';
import { minutosHoy } from '@/lib/entrenador/racha';
import { MISION, SOL_ACTUAL, ALERTA_ACTIVA } from '@/lib/mock/mision';
import { TARJETAS, CHEQUEO, valoresDelDia, nivelDeTarjeta } from '@/lib/mock/indicadores';
import styles from './InicioPantalla.module.scss';

export default function InicioPantalla() {
  const lecturas = useLecturas();
  const vals = valoresDelDia(lecturas, SOL_ACTUAL);

  const tarjetas = TARJETAS.map((t) => ({ ...t, nivel: nivelDeTarjeta(t, vals) }));
  const nivelGeneral = maxNivel(tarjetas.map((t) => t.nivel), ALERTA_ACTIVA.nivel);
  const chequeo = CHEQUEO.map((c) => ({ ...c, hecho: c.claves.every((k) => vals[k]?.hoy) }));
  const hechos = chequeo.filter((c) => c.hecho).length;

  return (
    <div className={styles.pantalla}>
      <Encabezado />

      <div className={styles.fila}>
        <EstadoGeneral nivel={nivelGeneral} />
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

function Encabezado() {
  return (
    <header className={styles.encabezado}>
      <div>
        <h1>Buen día, {MISION.astronauta.nombre}</h1>
        <p className={styles.sub}>
          Sol {SOL_ACTUAL} · {MISION.entorno}
        </p>
      </div>
      <div className={styles.chips}>
        <span className={styles.chip} title="Tiempo que tarda un mensaje en llegar a la Tierra">
          ⏱ Retraso con Tierra: <strong>{MISION.retrasoMin} min</strong>
        </span>
        <span className={styles.chip}>
          📡 Próximo contacto: <strong>{MISION.proximoContacto}</strong>
        </span>
      </div>
    </header>
  );
}

function EstadoGeneral({ nivel }) {
  const a = ALERTA_ACTIVA;
  return (
    <Card titulo="Estado general" acento={nivel} className={styles.estado}>
      <div className={styles.estadoNivel}>
        <TrafficLight nivel={nivel} />
      </div>

      <div className={styles.alerta}>
        <h3>
          <TrafficLight nivel={a.nivel} conTexto={false} /> {a.titulo}
        </h3>
        <p>{a.porQue}</p>
        <ul>
          {a.acciones.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <p className={styles.fuente}>Fuente: {a.fuente}</p>
      </div>

      <div className={styles.botones}>
        <Link className={styles.boton} href={`/mapa?zona=${a.zona}`}>
          Ver guía
        </Link>
        <Link className={styles.boton} href="/enlace">
          Avisar al oficial médico
        </Link>
        <Link className={`${styles.boton} ${styles.botonIa}`} href="/junta">
          Convocar junta médica
        </Link>
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
