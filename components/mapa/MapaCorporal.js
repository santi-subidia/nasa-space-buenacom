'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Card from '@/components/Card';
import TrafficLight from '@/components/TrafficLight';
import { NIVELES, maxNivel } from '@/lib/niveles';
import { SOL_ACTUAL, useEstadoMision } from '@/lib/datos/demo';
import { EVALUAR, META, valoresDelDia } from '@/lib/mock/indicadores';
import { ZONAS, PELIGROS } from '@/lib/content/zones';
import styles from './MapaCorporal.module.scss';

const COLOR = { green: 'var(--color-verde)', yellow: 'var(--color-amarillo)', orange: 'var(--color-naranja)', red: 'var(--color-rojo)' };

// Geometría de cada zona sobre la silueta (viewBox 300×620) y dónde va su marca de estado.
const FORMAS = {
  brain: { ancla: [150, 40], el: [{ t: 'ellipse', cx: 150, cy: 40, rx: 27, ry: 16 }] },
  eyes: { ancla: [150, 66], el: [{ t: 'ellipse', cx: 136, cy: 66, rx: 9, ry: 6 }, { t: 'ellipse', cx: 164, cy: 66, rx: 9, ry: 6 }] },
  inner_ear: { ancla: [192, 70], el: [{ t: 'circle', cx: 108, cy: 70, r: 7 }, { t: 'circle', cx: 192, cy: 70, r: 7 }] },
  immune: { ancla: [150, 134], el: [{ t: 'rect', x: 116, y: 126, width: 68, height: 16, rx: 8 }] },
  lungs: { ancla: [124, 185], el: [{ t: 'ellipse', cx: 126, cy: 188, rx: 21, ry: 38 }, { t: 'ellipse', cx: 174, cy: 188, rx: 21, ry: 38 }] },
  heart: { ancla: [153, 205], el: [{ t: 'circle', cx: 153, cy: 205, r: 15 }] },
  kidneys: { ancla: [130, 268], el: [{ t: 'ellipse', cx: 130, cy: 268, rx: 10, ry: 15 }, { t: 'ellipse', cx: 170, cy: 268, rx: 10, ry: 15 }] },
  muscles: { ancla: [75, 215], el: [{ t: 'rect', x: 62, y: 148, width: 26, height: 150, rx: 13 }, { t: 'rect', x: 212, y: 148, width: 26, height: 150, rx: 13 }] },
  bones: { ancla: [129, 440], el: [{ t: 'rect', x: 118, y: 360, width: 22, height: 170, rx: 11 }, { t: 'rect', x: 160, y: 360, width: 22, height: 170, rx: 11 }] },
};

const fmt = (v) => String(v).replace('.', ',');

function Forma({ f, ...props }) {
  if (f.t === 'ellipse') return <ellipse cx={f.cx} cy={f.cy} rx={f.rx} ry={f.ry} {...props} />;
  if (f.t === 'circle') return <circle cx={f.cx} cy={f.cy} r={f.r} {...props} />;
  return <rect x={f.x} y={f.y} width={f.width} height={f.height} rx={f.rx} {...props} />;
}

// Marca de estado dibujada con la forma del semáforo (no solo color).
function Marca({ nivel, x, y }) {
  const c = COLOR[nivel];
  const comun = { fill: c, stroke: 'var(--color-fondo)', strokeWidth: 2 };
  if (nivel === 'yellow') return <polygon points={`${x},${y - 8} ${x + 8},${y + 6} ${x - 8},${y + 6}`} {...comun} />;
  if (nivel === 'orange') return <polygon points={`${x},${y - 9} ${x + 9},${y} ${x},${y + 9} ${x - 9},${y}`} {...comun} />;
  if (nivel === 'red') return <rect x={x - 7} y={y - 7} width="14" height="14" rx="2" {...comun} />;
  return <circle cx={x} cy={y} r="7" {...comun} />;
}

export default function MapaCorporal() {
  const { lecturas, sintomas, evaluacion } = useEstadoMision(null, SOL_ACTUAL);
  const vals = valoresDelDia(lecturas, SOL_ACTUAL);
  const parametro = useSearchParams().get('zona');
  const herpeSol = sintomas.find((s) => s.code === 'cold_sore' || s.code === 'rash');
  const borrosa = [...sintomas].reverse().find((s) => s.code === 'blurred_vision' && (s.sol == null || s.sol >= SOL_ACTUAL - 6));

  // Zona con indicadores resueltos y nivel = máximo entre sus indicadores y el motor de reglas (#3).
  const zonas = ZONAS.map((z) => {
    const indicadores = z.indicadores.map((i) => {
      if (z.id === 'immune' && !i.clave && herpeSol) {
        return {
          nombre: 'Erupción (foto)',
          valor: `Herpes labial · sol ${herpeSol.sol ?? 41}`,
          nivel: evaluacion.zoneLevels?.immune || 'orange',
        };
      }
      if (z.id === 'eyes' && !i.clave && borrosa) {
        return { nombre: 'Visión borrosa', valor: `Sí · sol ${borrosa.sol ?? SOL_ACTUAL}`, nivel: 'yellow' };
      }
      if (!i.clave) return i;
      const dato = vals[i.clave];
      const { nombre, unidad } = META[i.clave];
      return {
        nombre,
        valor: dato ? `${fmt(dato.valor)} ${unidad}` : 'Sin dato',
        nivel: dato && EVALUAR[i.clave] ? EVALUAR[i.clave](dato.valor) : 'green',
      };
    });
    const nivel = maxNivel(indicadores.map((i) => i.nivel), evaluacion.zoneLevels?.[z.id] ?? 'green');
    return { ...z, indicadores, nivel };
  });

  const [elegida, setElegida] = useState(null);
  const [peligro, setPeligro] = useState(null);

  // Sin elección: la que pide la URL o la más delicada (hoy, el sistema inmune).
  const masAlta = zonas.reduce((a, b) => (NIVELES[b.nivel].orden > NIVELES[a.nivel].orden ? b : a));
  const zona = zonas.find((z) => z.id === (elegida ?? parametro)) ?? masAlta;
  const visible = (z) => !peligro || z.peligros.includes(peligro);

  return (
    <div className={styles.pantalla}>
      <header>
        <h1>Mapa corporal</h1>
        <p className={styles.sub}>Tocá una zona para ver su función, riesgos, indicadores y qué hacer · Sol {SOL_ACTUAL}</p>
      </header>

      <div className={styles.cuerpo}>
        <Card className={styles.mapa}>
          <div className={styles.filtro} role="group" aria-label="Filtrar por peligro">
            <button type="button" className={!peligro ? styles.activo : ''} aria-pressed={!peligro} onClick={() => setPeligro(null)}>
              Todos
            </button>
            {Object.entries(PELIGROS).map(([k, nombre]) => (
              <button
                key={k}
                type="button"
                title={nombre}
                className={peligro === k ? styles.activo : ''}
                aria-pressed={peligro === k}
                onClick={() => setPeligro(peligro === k ? null : k)}
              >
                {k}
              </button>
            ))}
          </div>
          <p className={styles.leyenda}>{peligro ? `Zonas afectadas por: ${PELIGROS[peligro]}` : 'Peligros: R I D G E'}</p>

          <svg viewBox="0 0 300 620" className={styles.svg} role="group" aria-label="Silueta del cuerpo con 9 zonas">
            <g className={styles.silueta}>
              <circle cx="150" cy="62" r="40" />
              <rect x="138" y="98" width="24" height="26" rx="6" />
              <path d="M98 124 Q150 112 202 124 L198 336 L102 336 Z" />
              <rect x="56" y="128" width="38" height="180" rx="19" />
              <rect x="206" y="128" width="38" height="180" rx="19" />
              <rect x="104" y="330" width="42" height="270" rx="20" />
              <rect x="154" y="330" width="42" height="270" rx="20" />
            </g>

            {zonas.map((z) => {
              const f = FORMAS[z.id];
              const sel = z.id === zona.id;
              return (
                <g
                  key={z.id}
                  className={`${styles.zona} ${sel ? styles.sel : ''} ${visible(z) ? '' : styles.apagada}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${z.nombre}: ${z.nivel}`}
                  aria-pressed={sel}
                  onClick={() => setElegida(z.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setElegida(z.id);
                    }
                  }}
                >
                  {f.el.map((forma, i) => (
                    <Forma key={i} f={forma} fill={COLOR[z.nivel]} fillOpacity="0.35" stroke={COLOR[z.nivel]} strokeWidth="2" />
                  ))}
                  <Marca nivel={z.nivel} x={f.ancla[0]} y={f.ancla[1]} />
                </g>
              );
            })}
          </svg>
        </Card>

        <div className={styles.detalle}>
          <div className={styles.chips} role="tablist" aria-label="Zonas">
            {zonas.map((z) => (
              <button
                key={z.id}
                type="button"
                role="tab"
                aria-selected={z.id === zona.id}
                className={`${styles.chipZona} ${z.id === zona.id ? styles.activo : ''} ${visible(z) ? '' : styles.apagada}`}
                onClick={() => setElegida(z.id)}
              >
                <TrafficLight nivel={z.nivel} conTexto={false} /> {z.nombre}
              </button>
            ))}
          </div>

          <Card acento={zona.nivel} className={styles.panel}>
            <div className={styles.panelTop}>
              <h2>{zona.nombre}</h2>
              <TrafficLight nivel={zona.nivel} />
            </div>
            <p>{zona.funcion}</p>

            <h3>Riesgos</h3>
            <ul>{zona.riesgos.map((r) => <li key={r}>{r}</li>)}</ul>
            <p className={styles.peligros}>
              {zona.peligros.map((k) => (
                <span key={k} className={styles.peligro} title={PELIGROS[k]}>
                  {k} · {PELIGROS[k]}
                </span>
              ))}
            </p>

            <h3>Indicadores</h3>
            <ul className={styles.indicadores}>
              {zona.indicadores.map((i) => (
                <li key={i.nombre}>
                  <span>{i.nombre}</span>
                  <strong>{i.valor}</strong>
                  <TrafficLight nivel={i.nivel} />
                </li>
              ))}
            </ul>

            <h3>Qué hacer</h3>
            <ul>{zona.queHacer.map((r) => <li key={r}>{r}</li>)}</ul>

            <p className={styles.fuente}>
              Fuente:{' '}
              <a href={zona.fuente.url} target="_blank" rel="noreferrer">
                {zona.fuente.titulo}
              </a>
            </p>

            <div className={styles.botones}>
              {zona.test && (
                <Link className={styles.boton} href={zona.test.href}>
                  {zona.test.etiqueta}
                </Link>
              )}
              <Link className={styles.boton} href="/tendencias">Ver tendencias</Link>
              <Link className={`${styles.boton} ${styles.ia}`} href={`/vega?zona=${zona.id}`}>
                ✦ Preguntar a Vega
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
