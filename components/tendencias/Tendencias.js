'use client';

import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
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

const EJE = { stroke: '#678198', tick: { fill: '#b9cbe2', fontSize: 11 }, tickLine: false };

const tooltip = {
  contentStyle: { background: '#0b2031', border: '1px solid #2b5970', borderRadius: 9, fontSize: 12, color: '#f3f6ff' },
  labelStyle: { color: 'var(--color-texto-suave)' },
  labelFormatter: (sol) => `Sol ${sol}`,
};

const prom = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const coma = (n, d = 1) => n.toFixed(d).replace('.', ',');

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

export default function Tendencias() {
  const { astronauta, lecturas } = useEstadoMision(null, SOL_ACTUAL);
  const [periodo, setPeriodo] = useState('mision');
  const rango = PERIODOS.find((p) => p.id === periodo);
  const sleepBase = astronauta?.baseline?.sleep_h ?? LINEA_BASE.sleep_h;
  const reactionBase = astronauta?.baseline?.reaction_ms ?? null;

  // Arma la serie completa (60 soles desde IndexedDB) aplicando lo registrado hoy en sol 42.
  const hoy = valoresDelDia(lecturas, SOL_ACTUAL);
  const serie = construirSerie(lecturas, hoy);
  const datos = serie.filter((d) => d.sol >= rango.desde && d.sol <= rango.hasta);
  const conEvento = datos.some((d) => d.sol === SOL_EVENTO);
  const hayPvt = datos.some((d) => d.reaction_ms != null);

  // Lectura de Vega calculada sobre la serie real de la misión.
  const caida = serie.filter((d) => d.sol >= 31 && d.sol <= 40 && d.sleep_h != null);
  const previo = serie.filter((d) => d.sol <= 30 && d.sleep_h != null);

  const marcaEvento = conEvento && (
    <ReferenceLine x={SOL_EVENTO} stroke={C.naranja} strokeDasharray="4 4" label={{ value: 'Sol 41', fill: C.naranja, fontSize: 11, position: 'top' }} />
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
          <Grafico>
            <LineChart data={datos} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke={C.borde} strokeDasharray="3 3" vertical={false} />
              <ReferenceArea y1={7} y2={9} fill={C.verde} fillOpacity={0.14} />
              <ReferenceArea y1={6} y2={7} fill={C.amarillo} fillOpacity={0.14} />
              <ReferenceArea y1={5} y2={6} fill={C.naranja} fillOpacity={0.14} />
              <ReferenceArea y1={3} y2={5} fill={C.rojo} fillOpacity={0.14} />
              <ReferenceLine y={sleepBase} stroke={C.texto} strokeDasharray="6 4" label={{ value: 'tu base', fill: C.texto, fontSize: 11, position: 'insideTopRight' }} />
              {marcaEvento}
              <XAxis dataKey="sol" {...EJE} />
              <YAxis domain={[3, 9]} ticks={[3, 5, 6, 7, 9]} {...EJE} />
              <Tooltip {...tooltip} formatter={(v) => [`${coma(v)} h`, 'Sueño']} />
              <Line type="monotone" dataKey="sleep_h" stroke={C.acento} strokeWidth={2.5} dot={periodo !== 'mision' && periodo !== '60'} isAnimationActive={false} />
            </LineChart>
          </Grafico>
          <Leyenda items={[['verde', '7–9 h'], ['amarillo', '6–7 h'], ['naranja', '5–6 h'], ['rojo', '< 5 h']]} />
        </Card>

        <Card titulo="Sueño vs. estrés">
          <Grafico>
            <LineChart data={datos} margin={{ top: 16, right: 0, left: -16, bottom: 0 }}>
              <CartesianGrid stroke={C.borde} strokeDasharray="3 3" vertical={false} />
              {marcaEvento}
              <XAxis dataKey="sol" {...EJE} />
              <YAxis yAxisId="h" domain={[3, 9]} {...EJE} />
              <YAxis yAxisId="e" orientation="right" domain={[0, 10]} {...EJE} />
              <Tooltip {...tooltip} />
              <Line yAxisId="h" type="monotone" name="Sueño (h)" dataKey="sleep_h" stroke={C.acento} strokeWidth={2.5} dot={false} isAnimationActive={false} />
              <Line yAxisId="e" type="monotone" name="Estrés (/10)" dataKey="stress" stroke={C.naranja} strokeWidth={2.5} strokeDasharray="6 3" dot={false} isAnimationActive={false} />
            </LineChart>
          </Grafico>
          <p className={styles.leyenda}>
            <span style={{ color: C.acento }}>━ Sueño (h)</span> <span style={{ color: C.naranja }}>╌ Estrés (/10)</span>
          </p>
        </Card>

        <Card titulo="Temperatura (°C)">
          <Grafico>
            <LineChart data={datos} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke={C.borde} strokeDasharray="3 3" vertical={false} />
              <ReferenceArea y1={36.1} y2={37.2} fill={C.verde} fillOpacity={0.14} />
              <ReferenceArea y1={37.3} y2={37.9} fill={C.amarillo} fillOpacity={0.14} />
              <ReferenceArea y1={38} y2={38.5} fill={C.rojo} fillOpacity={0.14} />
              {marcaEvento}
              <XAxis dataKey="sol" {...EJE} />
              <YAxis domain={[36, 38.5]} ticks={[36, 36.5, 37, 37.5, 38]} {...EJE} />
              <Tooltip {...tooltip} formatter={(v) => [`${coma(v)} °C`, 'Temperatura']} />
              <Line type="monotone" dataKey="temp" stroke={C.acento} strokeWidth={2.5} dot={periodo !== 'mision'} isAnimationActive={false} />
            </LineChart>
          </Grafico>
          <Leyenda items={[['verde', '36,1–37,2'], ['amarillo', '37,3–37,9'], ['rojo', '≥ 38,0']]} />
        </Card>

        <Card titulo="Ánimo (1–5)">
          <Grafico>
            <BarChart data={datos} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke={C.borde} strokeDasharray="3 3" vertical={false} />
              {marcaEvento}
              <XAxis dataKey="sol" {...EJE} />
              <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} {...EJE} />
              <Tooltip {...tooltip} formatter={(v) => [`${v} / 5`, 'Ánimo']} cursor={{ fill: 'rgba(255,255,255,0.06)' }} />
              <Bar dataKey="mood" isAnimationActive={false} radius={[3, 3, 0, 0]}>
                {datos.map((d) => (
                  <Cell key={d.sol} fill={C[{ green: 'verde', yellow: 'amarillo', orange: 'naranja', red: 'rojo' }[EVALUAR.mood(d.mood ?? 5)]]} />
                ))}
              </Bar>
            </BarChart>
          </Grafico>
          <Leyenda items={[['verde', '4–5'], ['amarillo', '3'], ['naranja', '1–2']]} />
        </Card>

        {hayPvt && (
          <Card titulo="Tiempo de reacción · PVT (ms)" className={styles.anchoCompleto}>
            <Grafico>
              <LineChart data={datos} margin={{ top: 16, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid stroke={C.borde} strokeDasharray="3 3" vertical={false} />
                <ReferenceArea y1={100} y2={349} fill={C.verde} fillOpacity={0.14} />
                <ReferenceArea y1={350} y2={449} fill={C.amarillo} fillOpacity={0.14} />
                <ReferenceArea y1={450} y2={700} fill={C.naranja} fillOpacity={0.14} />
                {reactionBase != null && (
                  <ReferenceLine
                    y={reactionBase}
                    stroke={C.texto}
                    strokeDasharray="6 4"
                    label={{ value: 'tu base', fill: C.texto, fontSize: 11, position: 'insideTopRight' }}
                  />
                )}
                {marcaEvento}
                <XAxis dataKey="sol" {...EJE} />
                <YAxis domain={[100, 600]} {...EJE} />
                <Tooltip {...tooltip} formatter={(v) => [`${Math.round(v)} ms`, 'Mediana PVT']} />
                <Line type="monotone" dataKey="reaction_ms" stroke={C.acento} strokeWidth={2.5} connectNulls dot isAnimationActive={false} />
              </LineChart>
            </Grafico>
            <Leyenda items={[['verde', '< 350 ms'], ['amarillo', '350–449 ms'], ['naranja', '≥ 450 ms']]} />
          </Card>
        )}
      </div>
    </PantallaVyta>
  );
}

function Grafico({ children }) {
  return (
    <div className={styles.grafico}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 420, height: 190 }}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}

// Leyenda de las bandas: color + texto (nunca solo color).
function Leyenda({ items }) {
  return (
    <p className={styles.leyenda}>
      {items.map(([color, texto]) => (
        <span key={texto}>
          <i style={{ background: C[color] }} aria-hidden="true" /> {texto}
        </span>
      ))}
    </p>
  );
}
