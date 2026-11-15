'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/Card';
import TrafficLight from '@/components/TrafficLight';
import { CHECKLIST_REFUGIO, LIMITE_CARRERA_MSV, panelCabina } from '@/lib/cabina/simulador';
import { TRIPULANTES } from '@/lib/demo/generador';
import { SOL_ACTUAL } from '@/lib/datos/demo';
import { useTripulanteActivo } from '@/lib/datos/tripulante';
import styles from './Cabina.module.scss';

// Estado de la demo (tormenta simulada y checklist): solo en este navegador.
export const CLAVE_CABINA = 'astrovitals:cabina:v1';
const INICIAL = { tormenta: false, enRefugio: false, hechos: [] };

const DOC = 'https://github.com/santi-subidia/nasa-space-buenacom/blob/main/doc/proyecto/sintesis/cabina-y-radiacion.md';
const coma = (n, d = 1) => Number(n).toFixed(d).replace('.', ',');

function usarEstadoCabina() {
  const [estado, setEstado] = useState(INICIAL);
  useEffect(() => {
    try {
      const guardado = JSON.parse(localStorage.getItem(CLAVE_CABINA) || 'null');
      if (guardado) setEstado({ ...INICIAL, ...guardado });
    } catch {
      /* sin almacenamiento: arranca limpio */
    }
  }, []);
  const cambiar = (parcial) =>
    setEstado((prev) => {
      const sig = { ...prev, ...parcial };
      try {
        localStorage.setItem(CLAVE_CABINA, JSON.stringify(sig));
      } catch {
        /* modo privado */
      }
      return sig;
    });
  return [estado, cambiar];
}

export default function CabinaPantalla() {
  const astronautId = useTripulanteActivo();
  const nombre = TRIPULANTES.find((t) => t.id === astronautId)?.name || 'Tripulante';
  const [estado, cambiar] = usarEstadoCabina();
  const panel = panelCabina({ sol: SOL_ACTUAL, astronautId, tormenta: estado.tormenta, enRefugio: estado.enRefugio });
  const { dosis } = panel;
  const spe = panel.alertas.find((a) => a.id === 'spe');
  const otras = panel.alertas.filter((a) => a.id !== 'spe');

  const escala = Math.max(720, Math.ceil(dosis.proyeccionRegreso / 60) * 60);
  const pct = (v) => `${(v / escala) * 100}%`;

  function alternarHecho(id) {
    const hechos = estado.hechos.includes(id) ? estado.hechos.filter((x) => x !== id) : [...estado.hechos, id];
    cambiar({ hechos, enRefugio: hechos.includes('refugio') });
  }

  return (
    <div className={styles.pantalla}>
      <header className={styles.encabezado}>
        <div>
          <h1>Cabina y radiación</h1>
          <p className={styles.sub}>Sol {SOL_ACTUAL} · Base Marte · sensores y dosímetro simulados con cifras de la NASA</p>
        </div>
        <TrafficLight nivel={panel.nivel} />
      </header>

      {spe && (
        <Card acento={spe.nivel} className={styles.tormenta} role="alert">
          <div className={styles.tormentaTop}>
            <div>
              <h2>
                <TrafficLight nivel={spe.nivel} conTexto={false} /> {spe.titulo}
              </h2>
              <p className={styles.texto}>{spe.porQue}</p>
            </div>
            <button type="button" className={styles.boton} onClick={() => cambiar(INICIAL)}>
              Fin del evento (demo)
            </button>
          </div>
          <ul className={styles.checklist}>
            {CHECKLIST_REFUGIO.map((paso) => (
              <li key={paso.id}>
                <label>
                  <input type="checkbox" checked={estado.hechos.includes(paso.id)} onChange={() => alternarHecho(paso.id)} />
                  {paso.texto}
                </label>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className={styles.fila}>
        <Card titulo={`Dosímetro personal · ${nombre}`} acento={dosis.nivel}>
          <div className={styles.dosis}>
            <strong className={styles.numero}>{coma(dosis.total)}</strong>
            <span className={styles.unidad}>mSv acumulados</span>
            <TrafficLight nivel={dosis.nivel} />
          </div>
          <p className={styles.texto}>
            <strong>{dosis.pctLimite} %</strong> de tu límite de carrera ({LIMITE_CARRERA_MSV} mSv). Quedan{' '}
            <strong>{coma(dosis.restante)} mSv</strong>.
          </p>

          <div className={styles.barra} role="img" aria-label={`Dosis ${coma(dosis.total)} de ${LIMITE_CARRERA_MSV} mSv; proyección al regreso ${coma(dosis.proyeccionRegreso)} mSv`}>
            <span className={styles.tramoTransito} style={{ width: pct(dosis.transito) }} />
            <span className={styles.tramoMarte} style={{ width: pct(dosis.superficie) }} />
            <span className={styles.marcaLimite} style={{ left: pct(LIMITE_CARRERA_MSV) }}>
              <em>Límite {LIMITE_CARRERA_MSV}</em>
            </span>
            <span className={styles.marcaProyeccion} style={{ left: pct(dosis.proyeccionRegreso) }}>
              <em>Regreso ≈ {Math.round(dosis.proyeccionRegreso)}</em>
            </span>
          </div>

          <dl className={styles.desglose}>
            <div>
              <dt><span className={styles.puntoTransito} /> Tránsito Tierra → Marte</dt>
              <dd>{coma(dosis.transito)} mSv · 180 días × 1,8 mSv/día</dd>
            </div>
            <div>
              <dt><span className={styles.puntoMarte} /> En Marte</dt>
              <dd>{coma(dosis.superficie)} mSv · {SOL_ACTUAL} soles × {coma(dosis.tasaMSvDia, 2)} (incluye EVA)</dd>
            </div>
            <div>
              <dt>Hoy equivale a</dt>
              <dd>≈ {Math.round(dosis.tasaMSvDia * 10)} radiografías de tórax por sol</dd>
            </div>
          </dl>
        </Card>

        <Card titulo="Clima espacial" acento={spe ? spe.nivel : 'green'}>
          <p className={styles.estadoSol}>
            <TrafficLight nivel={spe ? spe.nivel : 'green'} conTexto={false} />{' '}
            {spe ? 'Evento de partículas solares en curso' : 'Sin eventos solares'}
          </p>
          <p className={styles.texto}>
            Tasa de dosis ahora: <strong>{coma(panel.tasaActualMSvH * 1000, 0)} µSv/h</strong>
            {spe && estado.enRefugio ? ' (dentro del refugio)' : ''}
          </p>
          <p className={styles.texto}>
            Los rayos cósmicos galácticos llegan siempre y casi no se pueden blindar; las tormentas solares son raras pero
            intensas, y ahí el refugio sí protege.
          </p>
          {!spe && (
            <button type="button" className={`${styles.boton} ${styles.peligro}`} onClick={() => cambiar({ tormenta: true, enRefugio: false, hechos: [] })}>
              ☢ Simular tormenta solar
            </button>
          )}
        </Card>
      </div>

      <section className={styles.mosaico} aria-label="Atmósfera del hábitat">
        {panel.atmosfera.map((a) => (
          <Card key={a.id} acento={a.nivel} className={styles.sensor}>
            <span className={styles.sensorNombre}>{a.etiqueta}</span>
            <strong className={styles.sensorValor}>
              {coma(a.valor, a.unidad === 'mmHg' ? 2 : a.unidad === 'dBA' ? 0 : 1)} <small>{a.unidad}</small>
            </strong>
            <TrafficLight nivel={a.nivel} />
            <span className={styles.sensorDetalle}>{a.detalle}</span>
          </Card>
        ))}
      </section>

      {otras.length > 0 && (
        <Card titulo="Avisos de cabina">
          <ul className={styles.avisos}>
            {otras.map((a) => (
              <li key={a.id}>
                <TrafficLight nivel={a.nivel} conTexto={false} /> <strong>{a.titulo}.</strong> {a.porQue}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className={styles.fuente}>
        Fuentes: límite de 600 mSv (NASA-STD-3001), tasas medidas por Curiosity/RAD, CO₂ ≤ 3 mmHg y ruido NC-50/NC-40 (NASA-STD-3001)
        · detalle y enlaces en{' '}
        <a href={DOC} target="_blank" rel="noreferrer">
          doc/proyecto/sintesis/cabina-y-radiacion.md
        </a>
        . La cabina es un riesgo compartido: no cambia tu semáforo personal. <Link href="/salud/fisica?zona=lungs#mapa">Ver pulmones en el mapa</Link>
      </p>
    </div>
  );
}
