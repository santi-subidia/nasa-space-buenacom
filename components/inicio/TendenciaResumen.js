'use client';

import { useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Card from '@/components/Card';
import { SOL_ACTUAL } from '@/lib/datos/demo';
import { lecturasParaInicio, METRICAS_FIGMA } from './metricas';
import styles from './InicioPantalla.module.scss';

export default function TendenciaResumen({ lecturas, solActual = SOL_ACTUAL }) {
  const [indicador, setIndicador] = useState('hr_rest');
  const tarjeta = METRICAS_FIGMA.find((t) => t.claves[0] === indicador);
  // Sólo presentación: agrupa las lecturas existentes, sin generar ni guardar datos.
  const porSol = new Map();
  for (const lectura of lecturasParaInicio(lecturas, solActual)) {
    if (lectura.indicator !== indicador || !Number.isInteger(lectura.sol) || lectura.sol < solActual - 6 || lectura.sol > solActual) continue;
    if (!Number.isFinite(lectura.value)) continue;
    porSol.set(lectura.sol, { sol: lectura.sol, valor: lectura.value });
  }
  const datos = [...porSol.values()].sort((a, b) => a.sol - b.sol);

  return (
    <Card className={styles.tendencia} aria-label="Tendencia de signos vitales">
      <div className={styles.tendenciaCabecera}>
        <div className={styles.tituloConIcono}>
          <span className={styles.iconoTendencia} aria-hidden="true">⌁</span>
          <div><h2>Tendencia de signos vitales</h2><p>Últimos 7 soles</p></div>
        </div>
        <select aria-label="Indicador de la tendencia" value={indicador} onChange={(event) => setIndicador(event.target.value)}>
          {METRICAS_FIGMA.map((t) => <option key={t.id} value={t.claves[0]}>{t.nombre}</option>)}
        </select>
      </div>
      {datos.length > 0 ? (
        <div className={styles.grafico} role="img" aria-label={`${tarjeta.nombre} en ${indicador === 'sleep_h' ? 'h' : tarjeta.unidad}, del sol ${datos[0].sol} al ${datos.at(-1).sol}`}>
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 700, height: 160 }}>
            <AreaChart data={datos} margin={{ top: 12, right: 16, left: -24, bottom: 0 }} accessibilityLayer>
              <defs>
                <linearGradient id="inicio-tendencia" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#20d5f6" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#20d5f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#173044" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="sol" tickFormatter={(sol) => `Sol ${sol}`} stroke="#294051" tick={{ fill: '#aac0df', fontSize: 10 }} tickLine={false} minTickGap={20} />
              <YAxis domain={['auto', 'auto']} stroke="#294051" tick={{ fill: '#aac0df', fontSize: 10 }} tickLine={false} tickCount={4} />
              <Tooltip labelFormatter={(sol) => `Sol ${sol}`} formatter={(valor) => [`${Number(valor).toLocaleString('es-AR')} ${indicador === 'sleep_h' ? 'h' : tarjeta.unidad}`, tarjeta.nombre]} contentStyle={{ background: '#0b2031', border: '1px solid #2b5970', borderRadius: 9, fontSize: 12, color: '#f1f5ff' }} />
              <Area type="monotone" dataKey="valor" stroke="#20d5f6" strokeWidth={1.8} fill="url(#inicio-tendencia)" dot={{ r: 2.5, fill: '#8beeff', stroke: '#21b8e5' }} activeDot={{ r: 4, stroke: '#c3fbff' }} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : <p className={styles.sinDatos}>Todavía no hay lecturas de este indicador en los últimos 7 soles.</p>}
    </Card>
  );
}
