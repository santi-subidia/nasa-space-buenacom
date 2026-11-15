'use client';

import { useId, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Card from '@/components/Card';
import PantallaVyta from '@/components/layout/PantallaVyta';
import { SOL_ACTUAL, useEstadoMision } from '@/lib/datos/demo';
import { LINEA_BASE, EVALUAR, valoresDelDia } from '@/lib/mock/indicadores';
import { SERIE, SOL_EVENTO } from '@/lib/mock/series';
import { NIVELES } from '@/lib/niveles';
import styles from './Tendencias.module.scss';

const PERIODOS = [
  { id: '7', texto: '7 días', desde: SOL_ACTUAL - 6, hasta: SOL_ACTUAL },
  { id: '14', texto: '14 días', desde: SOL_ACTUAL - 13, hasta: SOL_ACTUAL },
  { id: 'mision', texto: 'Hasta hoy', desde: 1, hasta: SOL_ACTUAL },
  { id: '60', texto: '60 soles', desde: 1, hasta: 60 },
];

const C = {
  verde: 'var(--color-verde)',
  amarillo: 'var(--color-amarillo)',
  naranja: 'var(--color-naranja)',
  rojo: 'var(--color-rojo)',
  acento: 'var(--color-acento)',
  texto: 'var(--color-texto-suave)',
  borde: '#294357', // grilla de los gráficos del home
};

const COLOR_NIVEL = { green: C.verde, yellow: C.amarillo, orange: C.naranja, red: C.rojo };
const SIMBOLO = { circulo: '●', triangulo: '▲', rombo: '◆', cuadrado: '■' };
const SIMBOLO_COLOR = { verde: '●', amarillo: '▲', naranja: '◆', rojo: '■' };

// Zonas de cada indicador para colorear la línea: [límite inferior, color], de mayor a menor.
// Coinciden con las bandas y la leyenda de cada tarjeta.
const ZONAS = {
  sleep_h: [[7, C.verde], [6, C.amarillo], [5, C.naranja], [-Infinity, C.rojo]],
  temp: [[37.95, C.rojo], [37.25, C.amarillo], [-Infinity, C.verde]],
  mood: [[3.5, C.verde], [2.5, C.amarillo], [-Infinity, C.naranja]],
  reaction_ms: [[449.5, C.naranja], [349.5, C.amarillo], [-Infinity, C.verde]],
};

const coma = (n, d = 1) => n.toFixed(d).replace('.', ',');
const prom = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

// Qué muestra el tooltip de cada indicador.
const SERIES = {
  sleep_h: { clave: 'sleep_h', nombre: 'Sueño', fmt: (v) => `${coma(v)} h` },
  stress: { clave: 'stress', nombre: 'Estrés', fmt: (v) => `${v} / 10` },
  temp: { clave: 'temp', nombre: 'Temperatura', fmt: (v) => `${coma(v)} °C` },
  mood: { clave: 'mood', nombre: 'Ánimo', fmt: (v) => `${v} / 5` },
  reaction_ms: { clave: 'reaction_ms', nombre: 'Mediana PVT', fmt: (v) => `${Math.round(v)} ms` },
};

const EJE = { stroke: '#678198', tick: { fill: '#b9cbe2', fontSize: 11 }, tickLine: false };
const MARGEN = { top: 18, right: 10, left: -16, bottom: 0 };
const CURSOR = { stroke: '#7d98b0', strokeWidth: 1, strokeDasharray: '3 3' };
const PUNTO_ACTIVO = { r: 4.5, strokeWidth: 2, stroke: '#f3f6ff', fill: '#0b2031' };
const ANIMACION = { isAnimationActive: true, animationDuration: 500 };
const BANDA = 0.06; // las bandas quedan de contexto; el color lo lleva la línea

function construirSerie(lecturas, hoy) {
  const porSol = new Map();
  for (const l of lecturas) {
    if (!Number.isInteger(l?.sol)) continue;
    if (!porSol.has(l.sol)) porSol.set(l.sol, { sol: l.sol });
    porSol.get(l.sol)[l.indicator] = l.value;
  }

  if (porSol.size === 0) {
    return SERIE.map((d) =>
      d.sol !== SOL_ACTUAL
        ? d
        : {
            ...d,
            sleep_h: hoy.sleep_h?.hoy ? hoy.sleep_h.valor : d.sleep_h,
            stress: hoy.stress?.hoy ? hoy.stress.valor : d.stress,
            temp: hoy.temp?.hoy ? hoy.temp.valor : d.temp,
            mood: hoy.mood?.hoy ? hoy.mood.valor : d.mood,
          },
    );
  }

  const sols = [...porSol.keys()].sort((a, b) => a - b);
  return sols.map((sol) => {
    const fila = porSol.get(sol);
    if (sol !== SOL_ACTUAL) return fila;
    return {
      ...fila,
      sleep_h: hoy.sleep_h?.valor ?? fila.sleep_h,
      stress: hoy.stress?.valor ?? fila.stress,
      temp: hoy.temp?.valor ?? fila.temp,
      mood: hoy.mood?.valor ?? fila.mood,
    };
  });
}

// Marcas del eje X: todos los soles en períodos cortos; cada 7 (o 10) en los largos.
function ticksSol(datos) {
  const sols = datos.map((d) => d.sol);
  if (sols.length <= 14) return sols;
  const paso = sols.length <= 45 ? 7 : 10;
  const primero = sols[0];
  const ultimo = sols[sols.length - 1];
  const ticks = [primero];
  for (let s = Math.ceil((primero + 1) / paso) * paso; s < ultimo; s += paso) {
    if (s - ticks[ticks.length - 1] >= paso / 2) ticks.push(s);
  }
  if (ultimo - ticks[ticks.length - 1] < paso / 2) ticks.pop();
  ticks.push(ultimo);
  return ticks;
}

const zonaDe = (v, zonas) => zonas.find(([lim]) => v >= lim)[1];

/**
 * Trazo de la línea coloreado por zona. El degradado usa el cuadro del propio trazo
 * (objectBoundingBox), que va del máximo al mínimo de los datos, así que cada corte
 * cae exactamente en el umbral. Si la serie es plana, no hay cuadro: color sólido.
 */
function trazoPorZonas(id, datos, clave, zonas) {
  const vs = datos.map((d) => d[clave]).filter((v) => v != null);
  if (!vs.length) return { trazo: C.acento, defs: null };
  const max = Math.max(...vs);
  const min = Math.min(...vs);
  if (max === min) return { trazo: zonaDe(max, zonas), defs: null };

  const off = (v) => (max - v) / (max - min);
  const stops = [[0, zonaDe(max, zonas)]];
  for (let i = 0; i < zonas.length - 1; i++) {
    const lim = zonas[i][0];
    if (lim < max && lim > min) stops.push([off(lim), zonas[i][1]], [off(lim), zonas[i + 1][1]]);
  }
  stops.push([1, zonaDe(min, zonas)]);

  return {
    trazo: `url(#${id})`,
    defs: (
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        {stops.map(([o, c], i) => (
          <stop key={i} offset={o} style={{ stopColor: c }} />
        ))}
      </linearGradient>
    ),
  };
}

// Relleno suave bajo la línea, que se desvanece hacia abajo.
function Relleno({ id, color }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style={{ stopColor: color, stopOpacity: 0.28 }} />
      <stop offset="1" style={{ stopColor: color, stopOpacity: 0 }} />
    </linearGradient>
  );
}

function useIdSvg() {
  return `g${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

export default function Tendencias() {
  const { astronauta, lecturas } = useEstadoMision(null, SOL_ACTUAL);
  const [periodo, setPeriodo] = useState('mision');
  const [enfocado, setEnfocado] = useState(null);
  const idBase = useIdSvg();
  const rango = PERIODOS.find((p) => p.id === periodo);
  const sleepBase = astronauta?.baseline?.sleep_h ?? LINEA_BASE.sleep_h;
  const reactionBase = astronauta?.baseline?.reaction_ms ?? null;

  // Arma la serie completa (60 soles desde IndexedDB) aplicando lo registrado hoy en sol 42.
  const hoy = valoresDelDia(lecturas, SOL_ACTUAL);
  const serie = construirSerie(lecturas, hoy);
  const datos = serie.filter((d) => d.sol >= rango.desde && d.sol <= rango.hasta);
  const solesVisibles = new Set(datos.map((d) => d.sol));
  const conEvento = solesVisibles.has(SOL_EVENTO);
  const hayPvt = datos.some((d) => d.reaction_ms != null);
  const pocos = datos.length <= 14;

  // Lectura de Vega calculada sobre la serie real de la misión.
  const caida = serie.filter((d) => d.sol >= 31 && d.sol <= 40 && d.sleep_h != null);
  const previo = serie.filter((d) => d.sol <= 30 && d.sleep_h != null);

  // Tramo de la caída de sueño (soles 31–40) recortado al período visible.
  const caidaDesde = Math.max(31, rango.desde);
  const caidaHasta = Math.min(40, rango.hasta);
  const hayCaida = caidaDesde < caidaHasta && solesVisibles.has(caidaDesde) && solesVisibles.has(caidaHasta);

  const ejeX = {
    dataKey: 'sol',
    type: 'number',
    domain: ['dataMin', 'dataMax'],
    ticks: ticksSol(datos),
    allowDecimals: false,
    padding: { left: 6, right: 6 },
    ...EJE,
  };
  const comunes = { data: datos, margin: MARGEN, syncId: 'tendencias' };
  const punto = pocos ? { r: 2.5, strokeWidth: 0, fill: '#f3f6ff' } : false;

  const marcaEvento = conEvento && (
    <ReferenceLine
      x={SOL_EVENTO}
      stroke={C.naranja}
      strokeDasharray="4 4"
      label={{ value: `Sol ${SOL_EVENTO}`, fill: C.naranja, fontSize: 11, position: 'top' }}
    />
  );

  const sueno = trazoPorZonas(`${idBase}-sueno`, datos, 'sleep_h', ZONAS.sleep_h);
  const temp = trazoPorZonas(`${idBase}-temp`, datos, 'temp', ZONAS.temp);
  const animo = trazoPorZonas(`${idBase}-animo`, datos, 'mood', ZONAS.mood);
  const pvt = trazoPorZonas(`${idBase}-pvt`, datos, 'reaction_ms', ZONAS.reaction_ms);
  const relleno = `${idBase}-relleno`;
  const rellenoEstres = `${idBase}-relleno-estres`;

  // Con syncId todos los gráficos siguen al cursor, pero solo el que está bajo el mouse
  // muestra la tarjeta del tooltip; los demás muestran la guía y el punto activo.
  const tooltip = (id, series) => (
    <Tooltip cursor={CURSOR} content={<TooltipSol visible={enfocado === id} series={series} />} />
  );

  return (
    <PantallaVyta
      titulo="Tendencias"
      icono="/figma/nav-analitica.svg"
      subtitulo={`Cómo vienen tus indicadores · ${periodo === '60' ? 'misión completa (60 soles)' : `hasta el sol ${SOL_ACTUAL}`}`}
      acciones={
        <div className={styles.periodos} role="radiogroup" aria-label="Período">
          {PERIODOS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={periodo === p.id}
              className={periodo === p.id ? styles.activo : ''}
              onClick={() => setPeriodo(p.id)}
            >
              {p.texto}
            </button>
          ))}
        </div>
      }
    >
      <Card acento="ia" className={styles.vega}>
        <p className={styles.vegaTitulo}><span aria-hidden="true">✦</span> Lectura de Vega</p>
        <p>
          Entre los soles 31 y 40 dormiste en promedio <strong>{coma(prom(caida.map((d) => d.sleep_h)))} h</strong> (antes, {coma(prom(previo.map((d) => d.sleep_h)))} h) y
          tu estrés pasó de <strong>{coma(prom(previo.map((d) => d.stress)), 0)}</strong> a <strong>{coma(prom(caida.slice(-3).map((d) => d.stress)), 0)}</strong> sobre 10. En el
          sol 41 apareció herpes labial con temperatura algo alta. Es un patrón típico de reactivación viral: priorizá dormir 8 h
          esta noche y avisá al oficial médico. Es una observación, no un diagnóstico.
        </p>
      </Card>

      <div className={styles.graficos}>
        <Card titulo="Sueño (h)">
          <Grafico onEnter={() => setEnfocado('sueno')}>
            <AreaChart {...comunes}>
              <defs>
                {sueno.defs}
                <Relleno id={relleno} color={C.acento} />
              </defs>
              <CartesianGrid stroke={C.borde} strokeDasharray="3 3" vertical={false} />
              <ReferenceArea y1={7} y2={9} fill={C.verde} fillOpacity={BANDA} />
              <ReferenceArea y1={6} y2={7} fill={C.amarillo} fillOpacity={BANDA} />
              <ReferenceArea y1={5} y2={6} fill={C.naranja} fillOpacity={BANDA} />
              <ReferenceArea y1={3} y2={5} fill={C.rojo} fillOpacity={BANDA} />
              <ReferenceLine y={sleepBase} stroke={C.texto} strokeDasharray="6 4" label={{ value: 'tu base', fill: C.texto, fontSize: 11, position: 'insideTopRight' }} />
              {marcaEvento}
              <XAxis {...ejeX} />
              <YAxis domain={[3, 9]} ticks={[3, 5, 6, 7, 9]} {...EJE} />
              {tooltip('sueno', [SERIES.sleep_h])}
              <Area type="monotone" dataKey="sleep_h" stroke={sueno.trazo} strokeWidth={2.5} fill={`url(#${relleno})`} dot={punto} activeDot={PUNTO_ACTIVO} {...ANIMACION} />
            </AreaChart>
          </Grafico>
          <Leyenda items={[['verde', '7–9 h'], ['amarillo', '6–7 h'], ['naranja', '5–6 h'], ['rojo', '< 5 h']]} />
        </Card>

        <Card titulo="Sueño vs. estrés">
          <div onPointerEnter={() => setEnfocado('relacion')}>
            <Grafico alto={96}>
              <AreaChart {...comunes} margin={{ ...MARGEN, top: 14, bottom: 2 }}>
                <defs>
                  <Relleno id={`${relleno}-r`} color={C.acento} />
                </defs>
                <CartesianGrid stroke={C.borde} strokeDasharray="3 3" vertical={false} />
                {hayCaida && (
                  <ReferenceArea
                    x1={caidaDesde}
                    x2={caidaHasta}
                    fill="#b896ff"
                    fillOpacity={0.1}
                    label={{ value: 'sueño ↓ · estrés ↑', fill: '#c9b2ff', fontSize: 10, position: 'insideTopLeft' }}
                  />
                )}
                {conEvento && <ReferenceLine x={SOL_EVENTO} stroke={C.naranja} strokeDasharray="4 4" />}
                <XAxis {...ejeX} hide />
                <YAxis domain={[3, 9]} ticks={[5, 7, 9]} {...EJE} />
                {tooltip('relacion', [SERIES.sleep_h, SERIES.stress])}
                <Area type="monotone" dataKey="sleep_h" stroke={C.acento} strokeWidth={2.5} fill={`url(#${relleno}-r)`} dot={punto} activeDot={PUNTO_ACTIVO} {...ANIMACION} />
              </AreaChart>
            </Grafico>
            <Grafico alto={114}>
              <AreaChart {...comunes} margin={{ ...MARGEN, top: 4 }}>
                <defs>
                  <Relleno id={rellenoEstres} color={C.naranja} />
                </defs>
                <CartesianGrid stroke={C.borde} strokeDasharray="3 3" vertical={false} />
                {hayCaida && <ReferenceArea x1={caidaDesde} x2={caidaHasta} fill="#b896ff" fillOpacity={0.1} />}
                {conEvento && <ReferenceLine x={SOL_EVENTO} stroke={C.naranja} strokeDasharray="4 4" />}
                <XAxis {...ejeX} />
                <YAxis domain={[0, 10]} ticks={[0, 5, 10]} {...EJE} />
                <Tooltip cursor={CURSOR} content={() => null} />
                <Area type="monotone" dataKey="stress" stroke={C.naranja} strokeWidth={2.5} fill={`url(#${rellenoEstres})`} dot={punto} activeDot={PUNTO_ACTIVO} {...ANIMACION} />
              </AreaChart>
            </Grafico>
          </div>
          <p className={styles.leyenda}>
            <span><i style={{ background: C.acento }} aria-hidden="true" /> Sueño (h)</span>
            <span><i style={{ background: C.naranja }} aria-hidden="true" /> Estrés (/10)</span>
          </p>
        </Card>

        <Card titulo="Temperatura (°C)">
          <Grafico onEnter={() => setEnfocado('temp')}>
            <AreaChart {...comunes}>
              <defs>
                {temp.defs}
                <Relleno id={`${relleno}-t`} color={C.acento} />
              </defs>
              <CartesianGrid stroke={C.borde} strokeDasharray="3 3" vertical={false} />
              <ReferenceArea y1={36.1} y2={37.2} fill={C.verde} fillOpacity={BANDA} />
              <ReferenceArea y1={37.3} y2={37.9} fill={C.amarillo} fillOpacity={BANDA} />
              <ReferenceArea y1={38} y2={38.5} fill={C.rojo} fillOpacity={BANDA} />
              {marcaEvento}
              <XAxis {...ejeX} />
              <YAxis domain={[36, 38.5]} ticks={[36, 36.5, 37, 37.5, 38]} tickFormatter={(v) => coma(v)} {...EJE} />
              {tooltip('temp', [SERIES.temp])}
              <Area type="monotone" dataKey="temp" stroke={temp.trazo} strokeWidth={2.5} fill={`url(#${relleno}-t)`} dot={punto} activeDot={PUNTO_ACTIVO} {...ANIMACION} />
            </AreaChart>
          </Grafico>
          <Leyenda items={[['verde', '36,1–37,2'], ['amarillo', '37,3–37,9'], ['rojo', '≥ 38,0']]} />
        </Card>

        <Card titulo="Ánimo (1–5)">
          <Grafico onEnter={() => setEnfocado('animo')}>
            <AreaChart {...comunes}>
              <defs>
                {animo.defs}
                <Relleno id={`${relleno}-a`} color={C.acento} />
              </defs>
              <CartesianGrid stroke={C.borde} strokeDasharray="3 3" vertical={false} />
              <ReferenceArea y1={3.5} y2={5.5} fill={C.verde} fillOpacity={BANDA} />
              <ReferenceArea y1={2.5} y2={3.5} fill={C.amarillo} fillOpacity={BANDA} />
              <ReferenceArea y1={0.5} y2={2.5} fill={C.naranja} fillOpacity={BANDA} />
              {marcaEvento}
              <XAxis {...ejeX} />
              <YAxis domain={[0.5, 5.5]} ticks={[1, 2, 3, 4, 5]} {...EJE} />
              {tooltip('animo', [SERIES.mood])}
              <Area type="step" dataKey="mood" stroke={animo.trazo} strokeWidth={2.5} fill={`url(#${relleno}-a)`} dot={punto} activeDot={PUNTO_ACTIVO} {...ANIMACION} />
            </AreaChart>
          </Grafico>
          <Leyenda items={[['verde', '4–5'], ['amarillo', '3'], ['naranja', '1–2']]} />
        </Card>

        {hayPvt && (
          <Card titulo="Tiempo de reacción · PVT (ms)" className={styles.anchoCompleto}>
            <Grafico onEnter={() => setEnfocado('pvt')}>
              <AreaChart {...comunes} margin={{ ...MARGEN, left: -10 }}>
                <defs>
                  {pvt.defs}
                  <Relleno id={`${relleno}-p`} color={C.acento} />
                </defs>
                <CartesianGrid stroke={C.borde} strokeDasharray="3 3" vertical={false} />
                <ReferenceArea y1={100} y2={349} fill={C.verde} fillOpacity={BANDA} />
                <ReferenceArea y1={350} y2={449} fill={C.amarillo} fillOpacity={BANDA} />
                <ReferenceArea y1={450} y2={700} fill={C.naranja} fillOpacity={BANDA} />
                {reactionBase != null && (
                  <ReferenceLine
                    y={reactionBase}
                    stroke={C.texto}
                    strokeDasharray="6 4"
                    label={{ value: 'tu base', fill: C.texto, fontSize: 11, position: 'insideTopRight' }}
                  />
                )}
                {marcaEvento}
                <XAxis {...ejeX} />
                <YAxis domain={[100, 600]} {...EJE} />
                {tooltip('pvt', [SERIES.reaction_ms])}
                <Area type="monotone" dataKey="reaction_ms" stroke={pvt.trazo} strokeWidth={2.5} fill={`url(#${relleno}-p)`} connectNulls dot={{ r: 2.5, strokeWidth: 0, fill: '#f3f6ff' }} activeDot={PUNTO_ACTIVO} {...ANIMACION} />
              </AreaChart>
            </Grafico>
            <Leyenda items={[['verde', '< 350 ms'], ['amarillo', '350–449 ms'], ['naranja', '≥ 450 ms']]} />
          </Card>
        )}
      </div>
    </PantallaVyta>
  );
}

function Grafico({ children, alto, onEnter }) {
  return (
    <div className={styles.grafico} style={alto ? { height: alto } : undefined} onPointerEnter={onEnter}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 420, height: alto ?? 210 }}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}

// Tarjeta del tooltip: sol, valor y nivel del motor (símbolo + texto, nunca solo color).
function TooltipSol({ active, payload, label, series, visible }) {
  if (!visible || !active || !payload?.length) return null;
  const fila = payload[0].payload;
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipSol}>Sol {label}</p>
      {series.map((s) => {
        const v = fila[s.clave];
        if (v == null) return null;
        const nivel = EVALUAR[s.clave]?.(v);
        const info = NIVELES[nivel];
        return (
          <div key={s.clave} className={styles.tooltipFila}>
            <span>{s.nombre}</span>
            <strong>{s.fmt(v)}</strong>
            {info && (
              <em style={{ color: COLOR_NIVEL[nivel] }}>
                {SIMBOLO[info.forma]} {info.etiqueta}
              </em>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Leyenda de las bandas: forma + color + texto (nunca solo color).
function Leyenda({ items }) {
  return (
    <p className={styles.leyenda}>
      {items.map(([color, texto]) => (
        <span key={texto}>
          <b style={{ color: C[color] }} aria-hidden="true">{SIMBOLO_COLOR[color]}</b> {texto}
        </span>
      ))}
    </p>
  );
}
