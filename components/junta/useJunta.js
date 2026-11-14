'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { armarVistaJunta } from '@/ai/junta/vista.js';
import { guardarAviso } from '@/lib/datos/avisos';
import { leerLecturas, useLecturas } from '@/lib/datos/lecturas';
import { leerSintomas, useSintomas } from '@/lib/datos/sintomas';
import { MISION } from '@/lib/mock/mision';
import { armarEntradaJunta } from './entrada';

/**
 * Orquesta la consulta `tipo: 'board'` a POST /api/claude:
 * estado "pensando" con contador de segundos, manejo de respuesta guardada y registro de aviso al CMO.
 */
export function useJunta() {
  const lecturas = useLecturas();
  const sintomas = useSintomas();
  const datosRef = useRef({ lecturas: [], sintomas: [] });
  datosRef.current = { lecturas, sintomas };

  const [estado, setEstado] = useState({
    fase: 'pensando', // 'pensando' | 'lista' | 'error'
    vista: null,
    motivo: null,
    error: '',
    nivelMotorActual: armarEntradaJunta([], []).nivelMotor,
  });
  const [segundos, setSegundos] = useState(0);
  const [avisoEnviado, setAvisoEnviado] = useState(false);

  const abortRef = useRef(null);
  const pedidoIdRef = useRef(0);

  const convocar = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const pedidoId = ++pedidoIdRef.current;

    let lecturasActuales = datosRef.current.lecturas;
    let sintomasActuales = datosRef.current.sintomas;
    try {
      [lecturasActuales, sintomasActuales] = await Promise.all([leerLecturas(), leerSintomas()]);
    } catch {
      /* si IndexedDB falla, seguimos con los datos ya cargados */
    }
    if (controller.signal.aborted || pedidoId !== pedidoIdRef.current) return;

    const entrada = armarEntradaJunta(lecturasActuales, sintomasActuales);
    setSegundos(0);
    setAvisoEnviado(false);
    setEstado((prev) => ({
      ...prev,
      fase: 'pensando',
      error: '',
      nivelMotorActual: entrada.nivelMotor,
    }));

    try {
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(entrada),
        signal: controller.signal,
      });
      const data = await res.json();
      if (pedidoId !== pedidoIdRef.current) return;

      const vista = armarVistaJunta(data, MISION.astronauta.nombre);
      if (!vista) {
        setEstado((prev) => ({
          ...prev,
          fase: 'error',
          vista: null,
          motivo: data?.motivo ?? null,
          error: data?.error ?? 'No hay una respuesta disponible de la junta médica en este momento.',
        }));
        return;
      }

      setEstado({
        fase: 'lista',
        vista,
        motivo: data.motivo ?? null,
        error: '',
        nivelMotorActual: entrada.nivelMotor,
      });
    } catch (err) {
      if (err?.name === 'AbortError' || pedidoId !== pedidoIdRef.current) return;
      setEstado((prev) => ({
        ...prev,
        fase: 'error',
        vista: null,
        motivo: 'red',
        error: 'No pudimos conectar con el servidor para convocar a la junta médica.',
      }));
    }
  }, []);

  useEffect(() => {
    convocar();
    return () => {
      abortRef.current?.abort();
    };
  }, [convocar]);

  useEffect(() => {
    if (estado.fase !== 'pensando') return undefined;
    const id = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [estado.fase]);

  function avisarOficial() {
    if (!estado.vista) return;
    guardarAviso({
      nivel: estado.vista.nivelFinal === 'red' ? 'critica' : 'alta',
      categoria: 'junta_medica',
      motivo: estado.vista.sintesis.decision,
      origen: 'junta',
    });
    setAvisoEnviado(true);
  }

  return {
    ...estado,
    segundos,
    avisoEnviado,
    convocar,
    avisarOficial,
  };
}
