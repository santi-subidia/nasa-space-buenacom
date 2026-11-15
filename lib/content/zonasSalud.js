// Mapa corporal integrado en Salud: qué zonas van en cada subcategoría y cómo se evalúan.
// Reemplaza a la pantalla /mapa (que ahora redirige acá). El contenido educativo sigue en ./zones.js.

import { NIVELES, maxNivel } from '../niveles.js';
import { EVALUAR, META, valoresDelDia } from '../mock/indicadores.js';
import { panelCabina } from '../cabina/simulador.js';
import { ZONAS } from './zones.js';

/** Zonas del cuerpo que muestra cada subcategoría de Salud (`null` = todas, con filtro por peligro). */
export const ZONAS_POR_SECCION = {
  fisica: ['heart', 'lungs', 'muscles', 'bones', 'immune', 'kidneys', 'eyes', 'inner_ear'],
  mental: ['brain'],
  riesgos: null,
};

export { esZonaValida, rutaZona, seccionDeZona } from './rutaZona.js';

const fmt = (v) => String(v).replace('.', ',');

/**
 * Resuelve los indicadores de cada zona con las lecturas del día, los síntomas y el panel de cabina,
 * y calcula su nivel (máximo entre sus indicadores personales y el motor de reglas).
 */
export function evaluarZonas({ lecturas = [], sintomas = [], evaluacion = {}, sol }) {
  const vals = valoresDelDia(lecturas, sol);
  const herpes = sintomas.find((s) => s.code === 'cold_sore' || s.code === 'rash');
  const borrosa = [...sintomas].reverse().find((s) => s.code === 'blurred_vision' && (s.sol == null || s.sol >= sol - 6));
  const mareo = [...sintomas].reverse().find((s) => s.code === 'dizzy_standing' && (s.sol == null || s.sol >= sol - 6));
  const cabina = panelCabina({ sol });

  return ZONAS.map((z) => {
    const indicadores = z.indicadores.map((i) => {
      if (z.id === 'immune' && !i.clave && herpes) {
        return { nombre: 'Erupción (foto)', valor: `Herpes labial · sol ${herpes.sol ?? sol - 1}`, nivel: evaluacion.zoneLevels?.immune || 'orange' };
      }
      if (i.cabina) {
        const s = cabina.atmosfera.find((a) => a.id === i.cabina);
        const dec = s.unidad === 'mmHg' ? 2 : 0;
        return { nombre: i.nombre, valor: `${s.valor.toFixed(dec).replace('.', ',')} ${s.unidad}`, nivel: s.nivel, ambiental: true };
      }
      if (z.id === 'eyes' && !i.clave && borrosa) {
        return { nombre: 'Visión borrosa', valor: `Sí · sol ${borrosa.sol ?? sol}`, nivel: 'yellow' };
      }
      if (z.id === 'inner_ear' && !i.clave && mareo) {
        return { nombre: i.nombre, valor: `${mareo.severity >= 2 ? 'Moderado' : 'Leve'} · sol ${mareo.sol ?? sol}`, nivel: mareo.severity >= 2 ? 'orange' : 'yellow' };
      }
      if (!i.clave) return i;
      const dato = vals[i.clave];
      const { nombre, unidad } = META[i.clave];
      return {
        nombre,
        valor: dato ? `${fmt(dato.valor)} ${unidad}` : 'Sin dato',
        nivel: dato && EVALUAR[i.clave] ? EVALUAR[i.clave](dato.valor) : dato ? 'green' : null,
      };
    });
    // Los datos de cabina son ambientales: se ven en la lista pero no suben el nivel personal de la zona.
    const nivel = maxNivel(indicadores.filter((i) => !i.ambiental).map((i) => i.nivel).filter(Boolean), evaluacion.zoneLevels?.[z.id] ?? 'green');
    return { ...z, indicadores, nivel };
  });
}

/** Zona más delicada de una lista (para abrir el mapa en ella si la URL no pide otra). */
export function zonaMasDelicada(zonas) {
  return zonas.reduce((a, b) => ((NIVELES[b.nivel]?.orden ?? 0) > (NIVELES[a.nivel]?.orden ?? 0) ? b : a));
}
