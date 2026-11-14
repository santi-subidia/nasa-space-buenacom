// Arma la petición `tipo: 'board'` combinando el estado de hoy (mock + lecturas/síntomas guardados)
// con la serie base del sol 42 hasta que existan #3 (motor completo) y #4 (datos de demo).

import { ENTRADA_SOL42 } from '@/ai/junta/ejemplo-sol42.js';
import { maxNivel } from '@/lib/niveles';
import { ALERTA_ACTIVA, MISION, SOL_ACTUAL } from '@/lib/mock/mision';
import { TARJETAS, nivelDeTarjeta, valoresDelDia } from '@/lib/mock/indicadores';

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
  const vals = valoresDelDia(lecturasGuardadas, SOL_ACTUAL);
  const nivelIndicadores = maxNivel(TARJETAS.map((t) => nivelDeTarjeta(t, vals)));
  const nivelMotor = maxNivel(nivelIndicadores, ALERTA_ACTIVA.nivel);

  return {
    tipo: 'board',
    astronauta: { id: MISION.astronauta.id, nombre: MISION.astronauta.nombre },
    sol: SOL_ACTUAL,
    entorno: ENTRADA_SOL42.entorno,
    nivelMotor,
    alertas: [
      {
        id: ALERTA_ACTIVA.id,
        level: ALERTA_ACTIVA.nivel,
        zone: ALERTA_ACTIVA.zona,
        ruleId: ALERTA_ACTIVA.id,
        title: ALERTA_ACTIVA.titulo,
        why: ALERTA_ACTIVA.porQue,
        actions: ALERTA_ACTIVA.acciones,
        escalate: nivelMotor === 'red' ? 'flight_surgeon' : 'cmo',
      },
    ],
    lecturas: combinarLecturas(lecturasGuardadas),
    sintomas: combinarSintomas(sintomasGuardados),
  };
}
