'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { crearVoz } from '@/ai/vega/voz.js';
import { crearSesionVega } from '@/ai/vega/sesion.js';
import { guardarAviso } from '@/lib/datos/avisos';
import { useEstadoMision } from '@/lib/datos/demo';
import { SOL_ACTUAL, MISION } from '@/lib/mock/mision';
import { LINEA_BASE, valoresDelDia } from '@/lib/mock/indicadores';
import { evaluate } from '@/lib/motor/evaluar';
import { INDICADORES } from '@/lib/tipos';

const INICIAL = { fase: 'inactivo', mensajes: [], parcial: '', error: '', sugerirAviso: false };
const sinSuscripcion = () => () => {};
const estadoInicial = () => INICIAL;

/** Los datos del día que Vega ve junto a la pregunta (poco texto: el servidor los manda al modelo). */
export function datosDelDia(lecturas, sintomas = [], baseline = LINEA_BASE, nombre = MISION.astronauta.nombre) {
  const vals = valoresDelDia(lecturas, SOL_ACTUAL);
  const ev = evaluate(lecturas, baseline, 'mars_base', { symptoms: sintomas, sol: SOL_ACTUAL });
  const alerta = ev.alerts[0];
  const indicadores = {};
  for (const [id, { valor, hoy }] of Object.entries(vals)) {
    const def = INDICADORES[id];
    indicadores[def?.etiqueta ?? id] = `${valor} ${def?.unidad ?? ''}${hoy ? '' : ' (último dato, no es de hoy)'}`.trim();
  }
  return {
    tripulante: nombre,
    sol: SOL_ACTUAL,
    alerta_activa: alerta
      ? { nivel: alerta.level, titulo: alerta.title, por_que: alerta.why }
      : { nivel: ev.globalLevel, titulo: 'Sin alertas activas', por_que: 'Valores dentro de rango.' },
    indicadores,
  };
}

/**
 * Conecta la lógica de Vega (ai/vega) con React: micrófono, consulta a /api/claude, lectura en voz alta.
 * El micrófono y la voz solo existen en el navegador, así que se crean después de montar.
 */
export function useVega() {
  const { astronauta, lecturas, sintomas } = useEstadoMision(null, SOL_ACTUAL);
  const datosRef = useRef(null);
  const [motor, setMotor] = useState(null);

  useEffect(() => {
    datosRef.current = datosDelDia(
      lecturas,
      sintomas,
      astronauta?.baseline || LINEA_BASE,
      astronauta?.name || MISION.astronauta.nombre,
    );
  }, [astronauta, lecturas, sintomas]);

  useEffect(() => {
    let sesion;
    const voz = crearVoz({ alOirParcial: (texto) => sesion?.ponerParcial(texto) });
    sesion = crearSesionVega({
      voz,
      obtenerDatosDelDia: () => datosRef.current ?? datosDelDia([]),
      alAvisarOficial: guardarAviso,
    });
    setMotor({ sesion, voz });
    return () => sesion.cancelar();
  }, []);

  const estado = useSyncExternalStore(
    motor ? motor.sesion.suscribir : sinSuscripcion,
    motor ? motor.sesion.obtener : estadoInicial,
    estadoInicial,
  );

  return {
    ...estado,
    listo: Boolean(motor),
    voz: motor?.voz ?? null,
    soportaVoz: motor ? motor.voz.soportaReconocimiento : true,
    soportaLectura: motor ? motor.voz.soportaSintesis : true,
    preguntar: (texto) => motor?.sesion.preguntar(texto),
    preguntarPorVoz: () => motor?.sesion.preguntarPorVoz(),
    avisarOficial: () => motor?.sesion.avisarOficial(),
    cancelar: () => motor?.sesion.cancelar(),
  };
}
