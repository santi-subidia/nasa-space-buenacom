'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { crearChequeoPorVoz, PASOS_MATUTINOS } from '@/ai/chequeo/sesion.js';
import { guardarLecturas } from '@/lib/datos/lecturas';
import { useTripulanteActivo } from '@/lib/datos/tripulante';
import { SOL_ACTUAL } from '@/lib/mock/mision';
import { INDICADORES } from '@/lib/tipos';

const INICIAL = { fase: 'inactivo', pasoActual: null, hechos: {}, omitidos: [], mensajes: [], error: '' };
const sinSuscripcion = () => () => {};
const estadoInicial = () => INICIAL;

/** Cada medición dictada se guarda al instante como lectura con source 'voice' (aparece en Registrar e Inicio). */
function registrarPara(astronautId) {
  return (reading) => {
    guardarLecturas(
      [
        {
          indicator: reading.indicator,
          value: reading.value,
          unit: INDICADORES[reading.indicator]?.unidad ?? reading.unit,
          sol: SOL_ACTUAL,
          source: 'voice',
        },
      ],
      astronautId,
    ).catch((e) => console.error('No se pudo guardar la lectura por voz', e));
  };
}

/** Chequeo matutino por voz (ai/chequeo). Comparte con Vega la misma voz: el micrófono es uno solo. */
export function useChequeo(voz) {
  const activoId = useTripulanteActivo();
  const [sesion, setSesion] = useState(null);

  useEffect(() => {
    if (!voz) return undefined;
    const s = crearChequeoPorVoz({
      voz,
      astronautId: activoId,
      alRegistrar: registrarPara(activoId),
    });
    setSesion(s);
    return () => s.cancelar();
  }, [voz, activoId]);

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
