'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { crearVoz } from '@/ai/vega/voz.js';
import { crearSesionVega } from '@/ai/vega/sesion.js';
import { guardarAviso } from '@/lib/datos/avisos';
import { useLecturas } from '@/lib/datos/lecturas';
import { MISION, SOL_ACTUAL, ALERTA_ACTIVA } from '@/lib/mock/mision';
import { valoresDelDia } from '@/lib/mock/indicadores';
import { INDICADORES } from '@/lib/tipos';

const INICIAL = { fase: 'inactivo', mensajes: [], parcial: '', error: '', sugerirAviso: false };
const sinSuscripcion = () => () => {};
const estadoInicial = () => INICIAL;

/** Los datos del día que Vega ve junto a la pregunta (poco texto: el servidor los manda al modelo). */
export function datosDelDia(lecturas) {
  const vals = valoresDelDia(lecturas, SOL_ACTUAL);
  const indicadores = {};
  for (const [id, { valor, hoy }] of Object.entries(vals)) {
    const def = INDICADORES[id];
    indicadores[def?.etiqueta ?? id] = `${valor} ${def?.unidad ?? ''}${hoy ? '' : ' (último dato, no es de hoy)'}`.trim();
  }
  return {
    tripulante: MISION.astronauta.nombre,
    sol: SOL_ACTUAL,
    alerta_activa: { nivel: ALERTA_ACTIVA.nivel, titulo: ALERTA_ACTIVA.titulo, por_que: ALERTA_ACTIVA.porQue },
    indicadores,
  };
}

/**
 * Conecta la lógica de Vega (ai/vega) con React: micrófono, consulta a /api/claude, lectura en voz alta.
 * El micrófono y la voz solo existen en el navegador, así que se crean después de montar.
 */
export function useVega() {
  const lecturas = useLecturas();
  const datosRef = useRef(null);
  const [motor, setMotor] = useState(null);

  useEffect(() => {
    datosRef.current = datosDelDia(lecturas);
  }, [lecturas]);

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
