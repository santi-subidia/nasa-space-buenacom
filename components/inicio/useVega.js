'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { crearVoz } from '@/ai/vega/voz.js';
import { crearSesionVega } from '@/ai/vega/sesion.js';
import { guardarAviso } from '@/lib/datos/avisos';
import { useEstadoMision } from '@/lib/datos/demo';
import { valoresDelDia } from '@/lib/datos/indicadores';
import { evaluate } from '@/lib/motor/evaluar';
import { planificarEjerciciosDelDia } from '@/lib/entrenador/planificacion';
import { parsearNotaPvt } from '@/lib/pvt/metricas';
import { INDICADORES } from '@/lib/tipos';
import { RETRASO_SOLO_IDA_MIN } from '@/lib/enlace/logicaEnlace';

const INICIAL = { fase: 'inactivo', mensajes: [], parcial: '', error: '', sugerirAviso: false, continuo: false };
const sinSuscripcion = () => () => {};
const estadoInicial = () => INICIAL;

/** Los datos del día que Vega ve junto a la pregunta (poco texto: el servidor los manda al modelo). */
export function datosDelDia(lecturas, sintomas = [], baseline = {}, nombre = 'Crewmember', solActual = 42, entorno = 'mars_base', diaSemana = 'jueves') {
  const vals = valoresDelDia(lecturas, solActual);
  const ev = evaluate(lecturas, baseline, entorno, { symptoms: sintomas, sol: solActual });
  const lecturasHoy = (lecturas || []).filter((r) => r && r.sol === solActual);
  const planEjercicios = planificarEjerciciosDelDia({
    diaSemana,
    sol: solActual,
    evaluacion: ev,
    lecturasHoy,
    entorno,
  });
  const alerta = ev.alerts[0];
  const indicadores = {};
  for (const [id, { valor, hoy, note }] of Object.entries(vals)) {
    const def = INDICADORES[id];
    const pvt = id === 'reaction_ms' ? parsearNotaPvt(note) : null;
    const extraPvt = pvt
      ? ` (PVT: ${pvt.lapsos} lapses, ${pvt.erroresNoGo ?? 0} No-Go, ${pvt.estabilidadVor != null ? `VOR ${pvt.estabilidadVor} %, ` : ''}performance ${pvt.score} %)`
      : '';
    indicadores[def?.etiqueta ?? id] = `${valor} ${def?.unidad ?? ''}${extraPvt}${hoy ? '' : ' (latest reading, not from today)'}`.trim();
  }
  return {
    tripulante: nombre,
    sol: solActual,
    dia_semana: planEjercicios.diaSemana,
    alerta_activa: alerta
      ? { nivel: alerta.level, titulo: alerta.title, por_que: alerta.why }
      : { nivel: ev.globalLevel, titulo: 'No active alerts', por_que: 'Values within expected range.' },
    plan_ejercicio_hoy: {
      intensidad: planEjercicios.intensidad,
      minutos_objetivo: planEjercicios.minutosObjetivo,
      ejercicios_sugeridos: planEjercicios.sugeridos.map((e) => e.nombre),
      pendientes: planEjercicios.pendientes.map((e) => e.nombre),
      motivo: planEjercicios.motivo,
    },
    indicadores,
  };
}

/**
 * Connects VYTA/Vega logic (ai/vega) with React: Safari-compatible microphone,
 * /api/claude queries with today's data and history, read-aloud TTS.
 */
export function useVega({ seccion, resumen } = {}) {
  const { astronauta, solActual, mision, lecturas, sintomas } = useEstadoMision();
  const datosRef = useRef(null);
  const contextoRef = useRef('');
  const nivelRef = useRef(0);
  const [motor, setMotor] = useState(null);

  useEffect(() => {
    datosRef.current = datosDelDia(
      lecturas,
      sintomas,
      astronauta?.baseline || {},
      astronauta?.name || 'Crewmember',
      solActual,
      mision?.entorno || 'mars_base',
      mision?.diaSemana || 'jueves',
    );
  }, [astronauta, solActual, mision, lecturas, sintomas]);

  useEffect(() => {
    const partes = [];
    if (seccion) partes.push(`Section: ${seccion}`);
    if (resumen) partes.push(`Visible summary: ${resumen}`);
    contextoRef.current = partes.join('. ').slice(0, 600);
  }, [seccion, resumen]);

  useEffect(() => {
    let sesion;
    const voz = crearVoz({
      alOirParcial: (texto) => sesion?.ponerParcial(texto),
      alCambiar: (faseVoz) => sesion?.ponerFaseVoz(faseVoz),
      alNivel: (n) => { nivelRef.current = n; },
      alPulso: (n) => { nivelRef.current = n; },
    });
    sesion = crearSesionVega({
      voz,
      obtenerDatosDelDia: () => datosRef.current ?? datosDelDia([]),
      obtenerContextoPantalla: () => contextoRef.current || undefined,
      obtenerRetrasoTierraMin: () => RETRASO_SOLO_IDA_MIN,
      alAvisarOficial: guardarAviso,
    });
    setMotor({ sesion, voz });
    const alOcultar = () => {
      if (document.hidden) sesion.detenerConversacionContinua?.();
    };
    document.addEventListener('visibilitychange', alOcultar);
    return () => {
      document.removeEventListener('visibilitychange', alOcultar);
      sesion.detenerConversacionContinua?.();
    };
  }, []);

  const estado = useSyncExternalStore(
    motor ? motor.sesion.suscribir : sinSuscripcion,
    motor ? motor.sesion.obtener : estadoInicial,
    estadoInicial,
  );

  return {
    ...estado,
    listo: Boolean(motor),
    nivelRef,
    voz: motor?.voz ?? null,
    soportaVoz: motor ? motor.voz.soportaReconocimiento : true,
    soportaLectura: motor ? motor.voz.soportaSintesis : true,
    preguntar: (texto) => motor?.sesion.preguntar(texto),
    preguntarPorVoz: () => motor?.sesion.preguntarPorVoz(),
    iniciarConversacionContinua: () => motor?.sesion.iniciarConversacionContinua(),
    detenerConversacionContinua: () => motor?.sesion.detenerConversacionContinua(),
    terminarEscucha: () => motor?.sesion.terminarEscucha(),
    tocar: () => motor?.sesion.tocar(),
    tocarContinuo: () => motor?.sesion.tocarContinuo(),
    avisarOficial: () => motor?.sesion.avisarOficial(),
    cancelar: () => motor?.sesion.cancelar(),
  };
}
