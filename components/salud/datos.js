import { lecturasParaInicio, metricasDesdeLecturas } from '../inicio/metricas.js';
import { evaluate, evaluarIndicador } from '../../lib/motor/evaluar.js';
import { maxNivel } from '../../lib/niveles.js';
import { rutaZona } from '../../lib/content/rutaZona.js';

export const ETIQUETAS_NIVEL = { green: 'Estable', yellow: 'En seguimiento', orange: 'Alerta', red: 'Crítico' };
const numero = (n) => n.toLocaleString('es-AR', { maximumFractionDigits: 1 });
const VACIO = { valor: '—', unidad: '', nivel: null, estado: 'Sin datos', detalle: 'No hay una medición guardada para este indicador.' };
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
      estado: ETIQUETAS_NIVEL[nivel] || 'Registrada', detalle: `Última lectura: sol ${l.sol}.`, sol: l.sol };
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
  if (cognicion.valorNumerico != null) cognicion.detalle = `Tiempo de reacción del test. ${cognicion.detalle}`;

  const respiracion = dato('resp_rate', 'rpm');
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
        estado: ETIQUETAS_NIVEL[nivelCab] || 'Registrada',
        detalle: `Dosímetro Curiosity/RAD en BD: sol ${cabSol.sol}.`,
        sol: cabSol.sol,
      };
    }
  }

  const nivelMusculoOseo = zona(['bones', 'muscles']) ?? maxNivel([musculo.nivel, hueso.nivel].filter(Boolean));
  const filasRiesgo = [
    { nombre: 'Radiación acumulada', icono: 'radiation', nivel: radiacion.nivel, estado: radiacion.estado,
      detalle: radiacion.valorNumerico == null ? 'Sin mediciones de radiación guardadas.' : `Dosis acumulada registrada: ${radiacion.valor} mSv (límite 600 mSv).`, href: '/tendencias' },
    { nombre: 'Pérdida ósea/muscular', icono: 'dumbbell', nivel: nivelMusculoOseo,
      estado: ETIQUETAS_NIVEL[nivelMusculoOseo] || undefined,
      detalle: nivelMusculoOseo == null ? 'Sin mediciones óseas o musculares.' : `Masa muscular ${musculo.valor} % · Densidad ósea ${hueso.valor} % respecto a pre-vuelo.`, href: rutaZona('bones') },
    { nombre: 'Fatiga y recuperación', icono: 'fatigue', nivel: sueno.nivel,
      detalle: sueno.valorNumerico == null ? 'Sin registros de sueño.' : `Último descanso: ${sueno.valor} min.`, href: rutaZona('brain') },
    { nombre: 'Variabilidad inmunológica', icono: 'shield', nivel: zona(['immune']),
      detalle: zona(['immune']) == null ? 'Sin registros inmunológicos.' : 'Seguimiento de los registros y síntomas guardados.', href: rutaZona('immune') },
    { nombre: 'Aislamiento', icono: 'people', nivel: aislamiento.nivel, estado: aislamiento.estado,
      detalle: aislamiento.valorNumerico == null ? 'Sin una evaluación de aislamiento registrada.' : `Índice de aislamiento: ${aislamiento.valor} / 10 (${aislamiento.detalle})`, href: '/salud/mental' },
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
    vitales: [vital('hr_rest', 'Frecuencia cardíaca', 'heart'), vital('presion', 'Presión arterial', 'drop'),
      vital('spo2', 'Oxígeno en sangre', 'lungs'), vital('temp', 'Temperatura corporal', 'temp'),
      vital('hrv', 'HRV', 'pulse'), { ...respiracion, id: 'respiracion', nombre: 'Frecuencia respiratoria', icono: 'wind' }],
    fisica: { nivel: nivelFisico, alertas: fisicas, estados: [
      { nombre: 'Muscular', icono: 'arm', nivel: musculo.nivel ?? zona(['muscles']) },
      { nombre: 'Óseo', icono: 'bone', nivel: hueso.nivel ?? zona(['bones']) },
      { nombre: 'Inmunológico', icono: 'shield', nivel: zona(['immune']) },
      { nombre: 'Radiación', icono: 'radiation', nivel: radiacion.nivel, estado: radiacion.estado },
    ], indicadores: [
      { ...musculo, nombre: 'Masa muscular', icono: 'arm', id: 'masa' },
      { ...hueso, nombre: 'Densidad ósea', icono: 'bone', id: 'osea' },
      { ...adaptacion, nombre: 'Adaptación a microgravedad', icono: 'planet', id: 'adaptacion' },
      { ...radiacion, nombre: 'Radiación acumulada', icono: 'radiation', id: 'radiacion' },
    ] },
    mental: { nivel: nivelMental, alertas: mentales, estados: [
      { nombre: 'Ánimo', icono: 'mood', nivel: dato('mood').nivel },
      { nombre: 'Estrés', icono: 'bolt', nivel: estres.nivel },
      { nombre: 'Carga cognitiva', icono: 'brain', nivel: cognicion.nivel },
      { nombre: 'Aislamiento', icono: 'people', nivel: aislamiento.nivel },
    ], indicadores: [
      { ...estres, nombre: 'Estrés', icono: 'bolt', id: 'estres', progreso: estres.valorNumerico == null ? null : estres.valorNumerico / 10 },
      { ...sueno, nombre: 'Sueño y bienestar', icono: 'moon', id: 'sueno' },
      { ...cognicion, nombre: 'Carga cognitiva', icono: 'brain', id: 'cognicion', nota: 'Tiempo de reacción' },
      { ...aislamiento, nombre: 'Aislamiento social', icono: 'people', id: 'aislamiento', ...(aislamiento.valorNumerico == null ? {} : { progreso: aislamiento.valorNumerico / 10 }) },
    ] },
    riesgos: { nivel: disponibles.length || sintomas.some((s) => s.sol == null || s.sol <= sol) ? evaluacion.globalLevel : null,
      alertas, filas: filasRiesgo, estados: [
        { nombre: 'Radiación', icono: 'radiation', nivel: radiacion.nivel, estado: radiacion.estado },
        { nombre: 'Microgravedad', icono: 'float', nivel: adaptacion.nivel ?? zona(['bones', 'muscles']) },
        { nombre: 'Fatiga', icono: 'fatigue', nivel: sueno.nivel },
        { nombre: 'Factores psicológicos', icono: 'brain', nivel: nivelMental },
      ] },
    historia,
  };
}
