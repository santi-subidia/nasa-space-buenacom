// DATOS DE MENTIRA (mock) hasta integrar #4 (60 soles con el evento del sol 41).
// Historia "Día 42 en Marte": soles 1–30 todo verde; 31–40 el sueño cae y el estrés sube;
// sol 41 herpes labial + 37,5 °C; sol 42 hoy. Determinista (siempre los mismos números).

import { SOL_ACTUAL } from './mision';
import { VALORES_SOL_42 } from './indicadores';

export const SOL_EVENTO = 41;

// Generador pseudoaleatorio con semilla fija (mulberry32).
function azar(semilla) {
  let a = semilla;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const redondear = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
const entre = (v, a, b) => Math.min(b, Math.max(a, v));

export function generarSerie() {
  const r = azar(42);
  const ruido = (amp) => (r() * 2 - 1) * amp;
  const serie = [];

  for (let sol = 1; sol <= SOL_ACTUAL; sol++) {
    const caida = sol <= 30 ? 0 : Math.min(1, (sol - 30) / 10); // 0 → 1 entre el sol 31 y el 40
    const sleep_h = sol >= 41 ? (sol === 41 ? 5.3 : VALORES_SOL_42.sleep_h) : 7.8 - caida * 2.3 + ruido(sol <= 30 ? 0.5 : 0.3);
    const stress = sol >= 41 ? (sol === 41 ? 8 : VALORES_SOL_42.stress) : 3 + caida * 4.5 + ruido(0.9);
    const temp = sol === 41 ? 37.5 : sol === 42 ? VALORES_SOL_42.temp : 36.7 + ruido(0.2);
    const mood = sol <= 30 ? (r() < 0.6 ? 5 : 4) : sol === 41 ? 3 : entre(Math.round(4.2 - caida * 1.4 + ruido(0.5)), 2, 5);

    serie.push({
      sol,
      sleep_h: redondear(sleep_h),
      stress: Math.round(entre(stress, 1, 10)),
      temp: redondear(temp),
      mood: sol === 42 ? null : mood, // el ánimo de hoy todavía no se registró
    });
  }
  return serie;
}

export const SERIE = generarSerie();
