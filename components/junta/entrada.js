// Arma la petición `tipo: 'board'` combinando las lecturas y síntomas guardados
// con la evaluación real del motor de reglas (#3 y #4).

import { ENTRADA_SOL42 } from '@/ai/junta/ejemplo-sol42.js';
import { SOL_ACTUAL } from '@/lib/demo/generador';
import { maxNivel } from '@/lib/niveles';
import { evaluate } from '@/lib/motor/evaluar';
import { MISION } from '@/lib/mock/mision';
import { LINEA_BASE, TARJETAS, nivelDeTarjeta, valoresDelDia } from '@/lib/mock/indicadores';

const MAX_LECTURAS = 500;
const MAX_SINTOMAS = 50;

function horaDeIso(ts) {
  const m = String(ts ?? '').match(/T(\d{2}:\d{2})/);
  return m ? m[1] : 'hoy';
}

function formatearTs(item) {
  const ts = String(item?.ts ?? '');
  if (ts.startsWith('S')) return ts.slice(0, 16);
  const sol = Number.isInteger(item?.sol) ? item.sol : SOL_ACTUAL;
  return `S${sol} ${horaDeIso(ts)}`.slice(0, 16);
}

function combinarLecturas(lecturasGuardadas) {
  const validas = lecturasGuardadas.filter(
    (l) => typeof l?.indicator === 'string' && Number.isFinite(Number(l?.value)),
  );
  if (!validas.length) return ENTRADA_SOL42.lecturas;

  const actualizadasHoy = new Set(
    validas.filter((l) => (l.sol ?? SOL_ACTUAL) === SOL_ACTUAL).map((l) => l.indicator),
  );
  const base = ENTRADA_SOL42.lecturas.filter(
    (l) => !(String(l.ts).startsWith(`S${SOL_ACTUAL} `) && actualizadasHoy.has(l.indicator)),
  );
  const extras = validas.map((l) => ({
    id: l.id,
    astronautId: l.astronautId ?? MISION.astronauta.id,
    indicator: l.indicator,
    value: Number(l.value),
    unit: l.unit ?? '',
    ts: formatearTs(l),
    source: l.source ?? 'manual',
  }));
  return [...base, ...extras].slice(-MAX_LECTURAS);
}

function combinarSintomas(sintomasGuardados) {
  if (!sintomasGuardados.length) return ENTRADA_SOL42.sintomas;
  const extras = sintomasGuardados.map((s) => ({
    id: s.id,
    astronautId: s.astronautId ?? MISION.astronauta.id,
    bodyZone: s.bodyZone ?? 'immune',
    code: s.code ?? 'other',
    severity: Number(s.severity) || 1,
    ts: formatearTs(s),
  }));
  return [...ENTRADA_SOL42.sintomas, ...extras].slice(-MAX_SINTOMAS);
}

/** Construye el cuerpo de POST /api/claude con `tipo: 'board'`. */
export function armarEntradaJunta(lecturasGuardadas = [], sintomasGuardados = []) {
  const lecturasHastaHoy = lecturasGuardadas.filter((l) => l?.sol == null || l.sol <= SOL_ACTUAL);
  const sintomasHastaHoy = sintomasGuardados.filter((s) => s?.sol == null || s.sol <= SOL_ACTUAL);
  const evaluacion = evaluate(lecturasHastaHoy, LINEA_BASE, 'mars_base', {
    symptoms: sintomasHastaHoy,
    sol: SOL_ACTUAL,
  });

  const vals = valoresDelDia(lecturasHastaHoy, SOL_ACTUAL);
  const nivelIndicadores = maxNivel(TARJETAS.map((t) => nivelDeTarjeta(t, vals)));
  const nivelMotor = maxNivel(nivelIndicadores, evaluacion.globalLevel);
  const alertas = evaluacion.alerts.length
    ? evaluacion.alerts.map((a) => ({
        id: a.id,
        level: a.level,
        zone: a.zone,
        ruleId: a.ruleId,
        title: a.title,
        why: a.why,
        actions: a.actions,
        escalate: a.escalate,
      }))
    : ENTRADA_SOL42.alertas;

  return {
    tipo: 'board',
    astronauta: { id: MISION.astronauta.id, nombre: MISION.astronauta.nombre },
    sol: SOL_ACTUAL,
    entorno: ENTRADA_SOL42.entorno,
    nivelMotor,
    alertas,
    lecturas: combinarLecturas(lecturasHastaHoy),
    sintomas: combinarSintomas(sintomasHastaHoy),
  };
}
