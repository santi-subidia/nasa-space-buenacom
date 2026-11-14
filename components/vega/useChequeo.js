'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { crearChequeoPorVoz, PASOS_MATUTINOS } from '@/ai/chequeo/sesion.js';
import { guardarLecturas } from '@/lib/datos/lecturas';
import { MISION, SOL_ACTUAL } from '@/lib/mock/mision';
import { INDICADORES } from '@/lib/tipos';

const INICIAL = { fase: 'inactivo', pasoActual: null, hechos: {}, omitidos: [], mensajes: [], error: '' };
const sinSuscripcion = () => () => {};
const estadoInicial = () => INICIAL;

/** Cada medición dictada se guarda al instante como lectura con source 'voice' (aparece en Registrar e Inicio). */
function registrar(reading) {
  guardarLecturas([
    {
      indicator: reading.indicator,
      value: reading.value,
      unit: INDICADORES[reading.indicator]?.unidad ?? reading.unit,
      sol: SOL_ACTUAL,
      source: 'voice',
    },
  ]);
}

/** Chequeo matutino por voz (ai/chequeo). Comparte con Vega la misma voz: el micrófono es uno solo. */
export function useChequeo(voz) {
  const [sesion, setSesion] = useState(null);

  useEffect(() => {
    if (!voz) return undefined;
    const s = crearChequeoPorVoz({ voz, astronautId: MISION.astronauta.id, alRegistrar: registrar });
    setSesion(s);
    return () => s.cancelar();
  }, [voz]);

  const estado = useSyncExternalStore(
    sesion ? sesion.suscribir : sinSuscripcion,
    sesion ? sesion.obtener : estadoInicial,
    estadoInicial,
  );

  return {
    ...estado,
    pasos: PASOS_MATUTINOS,
    listo: Boolean(sesion),
    iniciar: () => sesion?.iniciar(),
    cancelar: () => sesion?.cancelar(),
  };
}
