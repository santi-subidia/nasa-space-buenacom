import { lecturasParaInicio, metricasDesdeLecturas } from '../inicio/metricas.js';
import { evaluate, evaluarIndicador } from '../../lib/motor/evaluar.js';
import { maxNivel } from '../../lib/niveles.js';
import { rutaZona } from '../../lib/content/rutaZona.js';

export const ETIQUETAS_NIVEL = { green: 'Stable', yellow: 'Monitoring', orange: 'Alert', red: 'Critical' };
const numero = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 1 });
const VACIO = { valor: '—', unidad: '', nivel: null, estado: 'No data', detalle: 'No saved measurement for this indicator.' };
const MENTALES = ['mood', 'stress', 'sleep_h', 'reaction_ms'];

export function esAlertaMental(alerta) {
  return alerta.zone === 'brain' || MENTALES.some((id) => alerta.ruleId === `threshold:${id}`);
}

/** Sólo adapta lecturas y resultados del motor a las tres composiciones de Figma. */
export function datosSalud({ lecturas = [], sintomas = [], evaluacion = {}, baseline = {}, sol, entorno = 'mars_base', cabina = [] }) {
  const disponibles = lecturasParaInicio(lecturas, sol);
  const ultimas = new Map(disponibles.map((l) => [l.indicator, l]));
  const dato = (id, unidad, sinUmbral = false) => {
    const l = ultimas.get(id);
    if (!l) return { ...VACIO };
    const nivel = sinUmbral ? null : evaluacion.indicatorLevels?.[id] ?? evaluarIndicador(id, l.value, baseline).level;
    return { valor: numero(l.value), valorNumerico: l.value, unidad: unidad ?? l.unit ?? '', nivel,
      estado: ETIQUETAS_NIVEL[nivel] || 'Logged', detalle: `Latest reading: Sol ${l.sol}.`, sol: l.sol };
  };
  const zona = (zonas) => {
    const hayDatos = Object.values(evaluacion.indicators || {}).some((i) => zonas.includes(i.zone)) ||
      sintomas.some((s) => (s.sol == null || s.sol <= sol) && zonas.includes(s.bodyZone));
    return hayDatos ? maxNivel(zonas.map((z) => evaluacion.zoneLevels?.[z])) : null;
  };
  const alertas = evaluacion.alerts || [];
  const mentales = alertas.filter(esAlertaMental);
  const fisicas = alertas.filter((a) => !esAlertaMental(a) || /sleep/.test(a.ruleId || ''));
  const vitalesInicio = metricasDesdeLecturas(lecturas, evaluacion, baseline, sol);
  const vital = (id, nombre, icono) => {
    const tarjeta = vitalesInicio.find((t) => t.id === id);
    const claves = tarjeta.claves;
    const nivel = claves.every((c) => ultimas.has(c)) && id !== 'hrv'
      ? maxNivel(claves.map((c) => evaluacion.indicatorLevels?.[c] ?? evaluarIndicador(c, ultimas.get(c).value, baseline).level)) : null;
    return { ...tarjeta, nombre, icono, nivel };
  };
  const estres = dato('stress', '/10');
  const sueno = dato('sleep_h', 'min');
  if (sueno.valorNumerico != null) {
    const minutos = Math.round(sueno.valorNumerico * 60);
    sueno.valor = `${Math.floor(minutos / 60)} h ${minutos % 60}`;
  }
  const cognicion = dato('reaction_ms', 'ms');
  if (cognicion.valorNumerico != null) cognicion.detalle = `Test reaction time. ${cognicion.detalle}`;

  const respiracion = dato('resp_rate', 'breaths/min');
  const musculo = dato('muscle_mass_pct', '%');
  const hueso = dato('bone_density_pct', '%');
  const adaptacion = dato('microgravity_adapt', '%');
  const aislamiento = dato('isolation_score', '/10');

  let radiacion = dato('radiation_msv', 'mSv');
  const listaCabina = Array.isArray(cabina) ? cabina : cabina ? [cabina] : [];
  if (radiacion.valorNumerico == null && listaCabina.length) {
    const radDeCabina = (c) => c?.radiationTotalMsv ?? c?.dosis?.total;
    const cabSol = [...listaCabina]
      .filter((c) => c && c.sol <= sol && Number.isFinite(radDeCabina(c)))
      .sort((a, b) => a.sol - b.sol)
      .at(-1);
    if (cabSol) {
      const dosisCab = radDeCabina(cabSol);
      const nivelCab = evaluarIndicador('radiation_msv', dosisCab, baseline).level;
      radiacion = {
        valor: numero(dosisCab),
        valorNumerico: dosisCab,
        unidad: 'mSv',
        nivel: nivelCab,
        estado: ETIQUETAS_NIVEL[nivelCab] || 'Logged',
        detalle: `Curiosity/RAD dosimeter in DB: Sol ${cabSol.sol}.`,
        sol: cabSol.sol,
      };
    }
  }

  const nivelMusculoOseo = zona(['bones', 'muscles']) ?? maxNivel([musculo.nivel, hueso.nivel].filter(Boolean));
  const filasRiesgo = [
    { nombre: 'Cumulative radiation', icono: 'radiation', nivel: radiacion.nivel, estado: radiacion.estado,
      detalle: radiacion.valorNumerico == null ? 'No saved radiation measurements.' : `Recorded cumulative dose: ${radiacion.valor} mSv (limit 600 mSv).`, href: '/tendencias' },
    { nombre: 'Bone/muscle loss', icono: 'dumbbell', nivel: nivelMusculoOseo,
      estado: ETIQUETAS_NIVEL[nivelMusculoOseo] || undefined,
      detalle: nivelMusculoOseo == null ? 'No bone or muscle measurements.' : `Muscle mass ${musculo.valor}% · Bone density ${hueso.valor}% vs. pre-flight.`, href: rutaZona('bones') },
    { nombre: 'Fatigue & recovery', icono: 'fatigue', nivel: sueno.nivel,
      detalle: sueno.valorNumerico == null ? 'No sleep logs.' : `Latest rest: ${sueno.valor}.`, href: rutaZona('brain') },
    { nombre: 'Immune variability', icono: 'shield', nivel: zona(['immune']),
      detalle: zona(['immune']) == null ? 'No immune logs.' : 'Tracking saved logs and symptoms.', href: rutaZona('immune') },
    { nombre: 'Isolation', icono: 'people', nivel: aislamiento.nivel, estado: aislamiento.estado,
      detalle: aislamiento.valorNumerico == null ? 'No recorded isolation assessment.' : `Isolation index: ${aislamiento.valor} / 10 (${aislamiento.detalle})`, href: '/salud/mental' },
  ];
  const nivelFisico = disponibles.some((l) => !MENTALES.includes(l.indicator)) || fisicas.length
    ? maxNivel(fisicas.map((a) => a.level), Object.values(evaluacion.indicators || {}).filter((i) => !MENTALES.includes(i.indicator)).map((i) => i.level)) : null;
  const nivelMental = MENTALES.some((id) => ultimas.has(id)) || mentales.length || aislamiento.nivel
    ? maxNivel(
        mentales.map((a) => a.level),
        [...MENTALES, 'isolation_score']
          .filter((id) => ultimas.has(id))
          .map((id) => evaluacion.indicatorLevels?.[id] ?? evaluarIndicador(id, ultimas.get(id).value, baseline).level),
      )
    : null;
  const historia = Array.from({ length: 7 }, (_, i) => {
    const dia = sol - 6 + i;
    const delDia = disponibles.filter((l) => l.sol === dia);
    const animo = delDia.filter((l) => l.indicator === 'mood').at(-1);
    // El gráfico conserva la lógica de alertas existente; nunca fabrica un porcentaje de riesgo.
    const tieneSintomas = sintomas.some((s) => s.sol === dia);
    const evaluacionDia = delDia.length || tieneSintomas ? evaluate(disponibles, baseline, entorno, { sol: dia, symptoms: sintomas }) : null;
    return { sol: dia, animo: animo?.value ?? null, alertas: evaluacionDia?.alerts.length ?? null };
  });
  return {
    vitales: [vital('hr_rest', 'Heart rate', 'heart'), vital('presion', 'Blood pressure', 'drop'),
      vital('spo2', 'Blood oxygen', 'lungs'), vital('temp', 'Body temperature', 'temp'),
      vital('hrv', 'HRV', 'pulse'), { ...respiracion, id: 'respiracion', nombre: 'Respiratory rate', icono: 'wind' }],
    fisica: { nivel: nivelFisico, alertas: fisicas, estados: [
      { nombre: 'Muscular', icono: 'arm', nivel: musculo.nivel ?? zona(['muscles']) },
      { nombre: 'Bone', icono: 'bone', nivel: hueso.nivel ?? zona(['bones']) },
      { nombre: 'Immune', icono: 'shield', nivel: zona(['immune']) },
      { nombre: 'Radiation', icono: 'radiation', nivel: radiacion.nivel, estado: radiacion.estado },
    ], indicadores: [
      { ...musculo, nombre: 'Muscle mass', icono: 'arm', id: 'masa' },
      { ...hueso, nombre: 'Bone density', icono: 'bone', id: 'osea' },
      { ...adaptacion, nombre: 'Microgravity adaptation', icono: 'planet', id: 'adaptacion' },
      { ...radiacion, nombre: 'Cumulative radiation', icono: 'radiation', id: 'radiacion' },
    ] },
    mental: { nivel: nivelMental, alertas: mentales, estados: [
      { nombre: 'Mood', icono: 'mood', nivel: dato('mood').nivel },
      { nombre: 'Stress', icono: 'bolt', nivel: estres.nivel },
      { nombre: 'Cognitive load', icono: 'brain', nivel: cognicion.nivel },
      { nombre: 'Isolation', icono: 'people', nivel: aislamiento.nivel },
    ], indicadores: [
      { ...estres, nombre: 'Stress', icono: 'bolt', id: 'estres', progreso: estres.valorNumerico == null ? null : estres.valorNumerico / 10 },
      { ...sueno, nombre: 'Sleep & wellness', icono: 'moon', id: 'sueno' },
      { ...cognicion, nombre: 'Cognitive load', icono: 'brain', id: 'cognicion', nota: 'Reaction time' },
      { ...aislamiento, nombre: 'Social isolation', icono: 'people', id: 'aislamiento', ...(aislamiento.valorNumerico == null ? {} : { progreso: aislamiento.valorNumerico / 10 }) },
    ] },
    riesgos: { nivel: disponibles.length || sintomas.some((s) => s.sol == null || s.sol <= sol) ? evaluacion.globalLevel : null,
      alertas, filas: filasRiesgo, estados: [
        { nombre: 'Radiation', icono: 'radiation', nivel: radiacion.nivel, estado: radiacion.estado },
        { nombre: 'Microgravity', icono: 'float', nivel: adaptacion.nivel ?? zona(['bones', 'muscles']) },
        { nombre: 'Fatigue', icono: 'fatigue', nivel: sueno.nivel },
        { nombre: 'Psychological factors', icono: 'brain', nivel: nivelMental },
      ] },
    historia,
  };
}
