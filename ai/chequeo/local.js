// Intérprete local de frases con números ("37 con 6", "118 sobre 76"): rápido, gratis y sin red.
// Si no puede (palabras en vez de dígitos, frase ambigua), devuelve null y la sesión le pregunta a Claude.
import { normalizar } from '../vega/texto.js';

// [indicador(es), pista en la frase]. El orden importa: lo más específico primero.
const PISTAS = [
  [['bp_sys', 'bp_dia'], /presion|tension/],
  [['spo2'], /oxigeno|saturacion|spo2/],
  [['hr_rest'], /pulso|frecuencia cardiaca|latidos|pulsaciones/],
  [['temp'], /temperatura|fiebre|grados/],
  [['stress'], /estres/],
  [['mood'], /animo|me siento/],
  [['sleep_h'], /dormi|sueno|horas de sueno/],
  [['water_ml'], /\bagua\b|\bml\b|mililitro|litro/],
  [['mass_kg'], /\bpeso\b|\bmasa\b|kilos?|\bkg\b/],
  [['glucose'], /glucosa|azucar/],
  [['exercise_min'], /ejercicio|entren/],
];

const PRESION = /(\d{2,3})\s*(?:sobre|\/|-|y|con|de)\s*(\d{2,3})/;
const DECIMAL = /(\d{1,3})\s*(?:con|coma|punto|\.)\s*(\d{1,2})\b/;
const NUMERO = /\d+(?:\.\d+)?/g;

/**
 * @param {string} texto  lo que dijo el tripulante
 * @param {{esperado?: string[]}} [contexto]  indicadores que se esperan en este paso del chequeo
 * @returns {{indicador:string, valor:number}[]|null}  (la unidad la pone validarMedicion)
 */
export function interpretarLocal(texto, { esperado = [] } = {}) {
  const t = normalizar(texto).replace(/(\d),(\d)/g, '$1.$2');

  const pista = PISTAS.find(([, re]) => re.test(t))?.[0] ?? null;
  const ids = pista ?? (esperado.length ? esperado : null);
  if (!ids) return null;

  // Presión: dos números.
  if (ids.length === 2 && ids[0] === 'bp_sys') {
    const m = t.match(PRESION);
    if (!m) return null;
    return [
      { indicador: 'bp_sys', valor: Number(m[1]) },
      { indicador: 'bp_dia', valor: Number(m[2]) },
    ];
  }
  // Una pista que no es la del paso (p. ej. dijo "temperatura" cuando se esperaba presión) igual se acepta.
  const indicador = ids[0];

  let valor;
  const decimal = t.match(DECIMAL);
  if (decimal) valor = Number(`${decimal[1]}.${decimal[2]}`);
  else {
    const numeros = t.match(NUMERO) ?? [];
    if (numeros.length !== 1) return null; // ninguno o ambiguo: que decida Claude
    valor = Number(numeros[0]);
  }

  if (indicador === 'sleep_h' && /y media/.test(t) && Number.isInteger(valor)) valor += 0.5;
  if (indicador === 'water_ml' && /litro/.test(t) && valor < 20) valor = Math.round(valor * 1000);

  return [{ indicador, valor }];
}
