export const ZONA_HORARIA_CHECKIN = 'America/Argentina/Buenos_Aires';

const formatoFecha = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_HORARIA_CHECKIN,
  year: 'numeric', month: '2-digit', day: '2-digit',
});

export function fechaCheckin(ahora = new Date()) {
  const partes = Object.fromEntries(formatoFecha.formatToParts(new Date(ahora)).map((parte) => [parte.type, parte.value]));
  return `${partes.year}-${partes.month}-${partes.day}`;
}

const INDICADORES_REGISTRAR = new Set(['bp_sys', 'bp_dia', 'hr_rest', 'glucose', 'temp', 'sleep_h', 'water_ml', 'stress', 'mood']);

/** Reconoce los chequeos que Registrar guardaba antes de tener una confirmación diaria. */
export function checkinAnterior(lecturas, sintomas, astronautId, fecha) {
  const registros = [
    ...lecturas.filter((lectura) => INDICADORES_REGISTRAR.has(lectura.indicator) &&
      (lectura.source == null || lectura.source === 'manual')),
    ...sintomas.filter((sintoma) => sintoma.bodyZone === 'immune' && sintoma.photoBlobId),
  ].filter((registro) => registro.astronautId === astronautId && !String(registro.id || '').startsWith('demo-') &&
    Number.isFinite(Date.parse(registro.ts)) && fechaCheckin(registro.ts) === fecha);
  if (!registros.length) return null;
  registros.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
  return { astronautId, fecha, ts: registros.at(-1).ts, origen: 'anterior' };
}
