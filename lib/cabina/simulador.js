// Panel de cabina simulado: dosímetro personal, clima espacial y atmósfera del hábitat.
// Cifras de referencia verificadas en doc/proyecto/sintesis/cabina-y-radiacion.md (NASA-STD-3001,
// Curiosity/RAD). Los sensores son simulados y deterministas por sol.
// Es un riesgo AMBIENTAL compartido: no entra al semáforo personal del motor (evaluate).
// Sin `@/` ni React para correr con `node --test`.

import { evaluarIndicador } from '../motor/evaluar.js';
import { nivelMaximo } from '../tipos.js';

export const LIMITE_CARRERA_MSV = 600;
export const TASA_TRANSITO_MSV_DIA = 1.8;
export const TASA_SUPERFICIE_MSV_DIA = 0.64;
export const DIAS_TRANSITO = 180;
export const SOLES_MISION = 60;

/** Dosis extra por sol según el tiempo en EVA y rover (Ana sale más que Marcos). */
const EXTRA_EVA_MSV_SOL = { ana: 0.09, marcos: 0.05 };

/** Tormenta solar simulada: tasa fuera y dentro del refugio (valores ilustrativos). */
export const TORMENTA = { fueraMSvH: 0.5, refugioMSvH: 0.08 };

export const CHECKLIST_REFUGIO = [
  { id: 'refugio', texto: 'Move to shelter: the module surrounded by water and food supplies provides shielding' },
  { id: 'eva', texto: 'Suspend EVAs and rover sorties until the all-clear notice' },
  { id: 'dosimetro', texto: 'Keep your personal dosimeter worn at all times' },
  { id: 'tierra', texto: 'Notify Earth (radiation team) and the crew medical officer' },
  { id: 'fin', texto: 'Wait for the event all-clear before leaving the shelter' },
];

function mulberry32(semilla) {
  let t = semilla >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const redondear = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

/**
 * Dosis efectiva acumulada de un tripulante al sol indicado.
 * @returns {{ transito:number, superficie:number, total:number, pctLimite:number, tasaMSvDia:number, tasaUSvH:number, proyeccionRegreso:number, restante:number, nivel:string }}
 */
export function dosisAcumulada(sol, astronautId = 'ana') {
  const extra = EXTRA_EVA_MSV_SOL[astronautId] ?? 0.05;
  const transito = DIAS_TRANSITO * TASA_TRANSITO_MSV_DIA;
  const tasaMSvDia = TASA_SUPERFICIE_MSV_DIA + extra;
  const superficie = sol * tasaMSvDia;
  const total = redondear(transito + superficie);
  const proyeccionRegreso = redondear(transito * 2 + SOLES_MISION * tasaMSvDia);
  return {
    transito: redondear(transito),
    superficie: redondear(superficie),
    total,
    pctLimite: Math.round((total / LIMITE_CARRERA_MSV) * 100),
    tasaMSvDia: redondear(tasaMSvDia, 2),
    tasaUSvH: redondear((tasaMSvDia * 1000) / 24.66, 1), // sol de 24 h 37 min (24,66 h)
    proyeccionRegreso,
    restante: redondear(Math.max(0, LIMITE_CARRERA_MSV - total)),
    nivel: evaluarIndicador('radiation_msv', total).level,
  };
}

/**
 * Atmósfera simulada del hábitat en un sol. Entre los soles 38 y 44 el depurador de CO₂
 * rinde menos (historia de la demo): el CO₂ sube por encima del objetivo de 2,5 mmHg.
 */
export function atmosferaDelSol(sol) {
  const r = mulberry32(sol * 7919 + 13);
  const depuradorLento = sol >= 38 && sol <= 44 ? 0.45 : 0;
  return {
    co2: redondear(2.1 + depuradorLento + (r() - 0.5) * 0.3, 2),
    o2: redondear(20.9 + (r() - 0.5) * 0.4),
    presionKpa: redondear(101.2 + (r() - 0.5) * 0.8),
    ruidoTrabajo: Math.round(51 + r() * 4),
    ruidoDescanso: Math.round(40 + r() * 4),
  };
}

/** Promedio de CO₂ de los últimos 7 soles (el objetivo NASA para evitar cefaleas es < 2,5 mmHg). */
export function co2Promedio7(sol) {
  const soles = Array.from({ length: 7 }, (_, i) => sol - i).filter((s) => s >= 1);
  return redondear(soles.reduce((acc, s) => acc + atmosferaDelSol(s).co2, 0) / soles.length, 2);
}

/**
 * Todo lo que muestra el panel de cabina.
 * @param {{ sol:number, astronautId?:string, tormenta?:boolean, enRefugio?:boolean }} opciones
 */
export function panelCabina({ sol, astronautId = 'ana', tormenta = false, enRefugio = false }) {
  const dosis = dosisAcumulada(sol, astronautId);
  const atm = atmosferaDelSol(sol);
  const prom7 = co2Promedio7(sol);

  const nivelCo2 = nivelMaximo(evaluarIndicador('co2_mmhg', atm.co2).level, prom7 >= 2.5 ? 'yellow' : 'green');
  const atmosfera = [
    {
      id: 'co2',
      etiqueta: 'CO₂',
      valor: atm.co2,
      unidad: 'mmHg',
      nivel: nivelCo2,
      detalle: `7-sol average: ${prom7} mmHg · target < 2.5 · limit 3`,
    },
    { id: 'o2', etiqueta: 'O₂', valor: atm.o2, unidad: '%', nivel: evaluarIndicador('o2_pct', atm.o2).level, detalle: 'Safe range 19.5–23.5%' },
    { id: 'presion', etiqueta: 'Pressure', valor: atm.presionKpa, unidad: 'kPa', nivel: 'green', detalle: 'Sea-level atmosphere' },
    {
      id: 'ruido',
      etiqueta: 'Noise (work)',
      valor: atm.ruidoTrabajo,
      unidad: 'dBA',
      nivel: evaluarIndicador('noise_dba', atm.ruidoTrabajo).level,
      detalle: `Rest: ${atm.ruidoDescanso} dB · limits NC-50 / NC-40`,
    },
  ];

  const alertas = [];
  if (tormenta) {
    alertas.push({
      id: 'spe',
      nivel: enRefugio ? 'orange' : 'red',
      titulo: enRefugio ? 'Solar storm: inside shelter' : 'Solar storm: take shelter now',
      porQue: `Solar particle event (simulated): ~${TORMENTA.fueraMSvH} mSv/h outside shelter, ~${TORMENTA.refugioMSvH} mSv/h inside.`,
    });
  }
  if (nivelCo2 !== 'green') {
    alertas.push({
      id: 'co2',
      nivel: nivelCo2,
      titulo: 'CO₂ rising',
      porQue: `Currently ${atm.co2} mmHg (limit 3); 7-sol average ${prom7} mmHg, ${
        prom7 >= 2.5 ? 'above' : 'near'
      } the 2.5 target to avoid headaches. The CO₂ scrubber is underperforming: inspect and ventilate.`,
    });
  }
  if (dosis.proyeccionRegreso >= LIMITE_CARRERA_MSV) {
    alertas.push({
      id: 'proyeccion',
      nivel: 'yellow',
      titulo: 'Full mission exceeds career limit',
      porQue: `Including the return transit, projected dose is ${dosis.proyeccionRegreso} mSv (600 limit): NASA requires a waiver before the mission. Every EVA counts.`,
    });
  }

  const tasaActualMSvH = tormenta ? (enRefugio ? TORMENTA.refugioMSvH : TORMENTA.fueraMSvH) : dosis.tasaUSvH / 1000;
  const nivel = nivelMaximo(dosis.nivel, ...atmosfera.map((a) => a.nivel), ...alertas.map((a) => a.nivel));

  return { sol, astronautId, dosis, atmosfera, alertas, tormenta, enRefugio, tasaActualMSvH, nivel };
}
