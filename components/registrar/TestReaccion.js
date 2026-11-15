'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Card from '@/components/Card';
import { silenciarLogsMediaPipe } from '@/lib/mediapipe/silenciarLogs';
import { evaluarIndicador } from '@/lib/motor/evaluar';
import {
  CUENTA_REGRESIVA_S,
  avanzarCalibracionDedo,
  crearEstadoCalibracion,
} from '@/lib/pvt/calibracion';
import {
  DURACION_BLOQUE1_S,
  DURACION_PVT_S,
  ISI_MAX_MS,
  ISI_MIN_MS,
  TIMEOUT_BALIZA_MS,
  UMBRAL_LAPSO_MS,
  calcularMetricasPvt,
} from '@/lib/pvt/metricas';
import {
  calcularMetricasVor,
  calcularOrientacionCabeza,
  extraerEstadoOcular,
} from '@/lib/pvt/vestibular';
import styles from './Registrar.module.scss';

const WASM = '/mediapipe/wasm';
const MODELO_CARA =
  process.env.NEXT_PUBLIC_FACE_MODEL_URL ||
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const MODELO_MANO =
  process.env.NEXT_PUBLIC_HAND_MODEL_URL ||
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const ETIQUETA_NIVEL = {
  green: '● Óptimo',
  yellow: '▲ Seguimiento',
  orange: '◆ Fatiga / Alerta',
  red: '■ Crítico',
};

const TITULO_FASE = {
  cargando: 'Preparando sensores',
  esperando_dedo: 'Calibración · Mostrá tu dedo',
  cuenta_regresiva: 'Dedo detectado · Preparate',
  bloque1: 'Bloque 1 · Pilotaje Go/No-Go',
  bloque2: 'Bloque 2 · Estabilidad Vestibular VOR',
};

const CANVAS_W = 800;
const CANVAS_H = 500;
const RADIO_BALIZA = 34;
const RADIO_CAPTURA = 46;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function generarPosicionBaliza(rx, ry) {
  const pad = 64;
  for (let i = 0; i < 14; i++) {
    const x = pad + Math.random() * (CANVAS_W - pad * 2);
    const y = pad + Math.random() * (CANVAS_H - pad * 2);
    if (Math.hypot(x - rx, y - ry) >= 180) return { x, y };
  }
  return {
    x: rx < CANVAS_W / 2 ? CANVAS_W - pad : pad,
    y: ry < CANVAS_H / 2 ? CANVAS_H - pad : pad,
  };
}

function dibujarReticle(ctx, reticle, color = '#5bc8f5') {
  const { x, y } = reticle;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 18, 0, Math.PI * 2);
  ctx.moveTo(x - 28, y);
  ctx.lineTo(x - 10, y);
  ctx.moveTo(x + 10, y);
  ctx.lineTo(x + 28, y);
  ctx.moveTo(x, y - 28);
  ctx.lineTo(x, y - 10);
  ctx.moveTo(x, y + 10);
  ctx.lineTo(x, y + 28);
  ctx.stroke();
  ctx.restore();
}

function dibujarPanelTexto(ctx, x, y, w, h) {
  const r = 16;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function dibujarCalibracion(ctx, m, ahora) {
  const cx = CANVAS_W / 2;
  const cy = CANVAS_H / 2;

  if (m.fase === 'esperando_dedo') {
    const pulso = 1 + Math.sin(ahora / 350) * 0.06;
    ctx.save();
    ctx.strokeStyle = 'rgba(91, 200, 245, 0.35)';
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy - 34, 72 * pulso, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    dibujarPanelTexto(ctx, cx - 270, cy + 56, 540, 88);
    ctx.fillStyle = 'rgba(7, 11, 20, 0.82)';
    ctx.fill();
    ctx.strokeStyle = m.calibracion.dedoPerdido ? 'rgba(250, 204, 21, 0.5)' : 'rgba(91, 200, 245, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e8edf7';
    ctx.font = '700 21px sans-serif';
    ctx.fillText('Mostrá tu dedo índice frente a la cámara', cx, cy + 84);

    ctx.fillStyle = m.calibracion.dedoPerdido ? '#facc15' : '#9aa6c4';
    ctx.font = '500 15px sans-serif';
    ctx.fillText(
      m.calibracion.dedoPerdido
        ? 'Se perdió el dedo · Volvé a ubicarlo para iniciar la cuenta regresiva'
        : 'El test de 30 s comenzará tras una cuenta regresiva al detectarlo',
      cx,
      cy + 116,
    );
    ctx.restore();
    return;
  }

  // Fase cuenta_regresiva
  if (m.reticle.detectada) {
    dibujarReticle(ctx, m.reticle, '#4ade80');
  }

  const restanteS = m.cuentaUi ?? CUENTA_REGRESIVA_S;
  const progreso = clamp(m.progresoCuenta ?? 0, 0, 1);
  const color = m.reticle.detectada ? '#4ade80' : '#facc15';

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy - 22, 74, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(7, 11, 20, 0.84)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(91, 200, 245, 0.22)';
  ctx.lineWidth = 8;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy - 22, 74, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progreso);
  ctx.strokeStyle = color;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.font = '700 68px monospace';
  ctx.fillText(String(restanteS), cx, cy - 20);

  dibujarPanelTexto(ctx, cx - 230, cy + 78, 460, 48);
  ctx.fillStyle = 'rgba(7, 11, 20, 0.82)';
  ctx.fill();
  ctx.fillStyle = '#e8edf7';
  ctx.font = '600 17px sans-serif';
  ctx.fillText(
    m.reticle.detectada ? '¡Dedo detectado! Mantené la mano firme…' : 'Mantené el dedo frente a la cámara',
    cx,
    cy + 102,
  );
  ctx.restore();
}

function actualizarManoDesdeVideo(m, video, ahora) {
  const resMano = m.handLandmarker.detectForVideo(video, ahora);
  const punta = resMano?.landmarks?.[0]?.[8];
  if (punta) {
    const targetX = clamp((1 - punta.x - 0.15) / 0.7, 0, 1) * CANVAS_W;
    const targetY = clamp((punta.y - 0.15) / 0.7, 0, 1) * CANVAS_H;
    if (!m.reticle.detectada) {
      m.reticle.x = targetX;
      m.reticle.y = targetY;
    } else {
      m.reticle.x += (targetX - m.reticle.x) * 0.45;
      m.reticle.y += (targetY - m.reticle.y) * 0.45;
    }
    m.reticle.detectada = true;
  } else {
    m.reticle.detectada = false;
  }
}

// Chequeo Sensoriomotor y Cognitivo (30 s) en modal adaptable a pantalla:
// - Calibración (solo cámara): espera detección del dedo índice + cuenta regresiva de 3 s.
// - Bloque 1 (0-15 s): Pilotaje con mano en el aire (HandLandmarker) o puntero + Go/No-Go.
// - Bloque 2 (15-30 s): Estabilidad vestibular VOR (giro de cabeza + ojos con FaceLandmarker) o seguimiento suave.
// Se usa en Actividad · Ejercicios cognitivos; `className` ajusta la tarjeta a esa pantalla.
export default function TestReaccion({ resultado, baselineMs = null, mareo = 0, onMareo, onTerminar, className }) {
  const [fase, setFase] = useState('inactivo'); // inactivo | cargando | esperando_dedo | cuenta_regresiva | bloque1 | bloque2
  const [modoCamara, setModoCamara] = useState(false);
  const [restante, setRestante] = useState(DURACION_PVT_S);
  const [cuentaRegresiva, setCuentaRegresiva] = useState(CUENTA_REGRESIVA_S);
  const [errorCamara, setErrorCamara] = useState('');
  const [aviso, setAviso] = useState('');
  const [pistaVivo, setPistaVivo] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const motorRef = useRef({
    fase: 'inactivo',
    modoCamara: false,
    stream: null,
    handLandmarker: null,
    faceLandmarker: null,
    raf: 0,
    ultimoVideoT: -1,
    inicioMs: 0,
    calibracion: crearEstadoCalibracion(),
    cuentaUi: null,
    progresoCuenta: 0,
    reticle: { x: CANVAS_W / 2, y: CANVAS_H / 2, detectada: false },
    baliza: null,
    proximoSpawnMs: 0,
    flash: null,
    eventos: [],
    vorMuestras: [],
    ultimoVorSampleMs: 0,
    ultimaUiMs: 0,
    cabezaVivo: { yawDeg: 0, ojosAbiertos: true },
  });

  const liberarRecursos = useCallback(() => {
    const m = motorRef.current;
    if (m.raf) cancelAnimationFrame(m.raf);
    m.raf = 0;
    m.stream?.getTracks().forEach((t) => t.stop());
    m.stream = null;
    m.handLandmarker?.close?.();
    m.handLandmarker = null;
    m.faceLandmarker?.close?.();
    m.faceLandmarker = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => liberarRecursos, [liberarRecursos]);

  const cancelar = useCallback(() => {
    motorRef.current.fase = 'inactivo';
    liberarRecursos();
    setFase('inactivo');
    setPistaVivo('');
  }, [liberarRecursos]);

  // Bloqueo de scroll y cierre con Escape mientras el modal está abierto.
  useEffect(() => {
    if (fase === 'inactivo') return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e) => {
      if (e.code === 'Escape') cancelar();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [fase, cancelar]);

  const finalizarTest = useCallback(() => {
    const m = motorRef.current;
    m.fase = 'inactivo';
    const usoCamara = m.modoCamara;
    liberarRecursos();
    setFase('inactivo');
    setPistaVivo('');

    const vor = calcularMetricasVor(m.vorMuestras);
    const metricas = calcularMetricasPvt(m.eventos, {
      baselineMs,
      vor,
      modoEntrada: usoCamara ? 'camara' : 'puntero',
    });

    if (metricas.intentos > 0) {
      onTerminar(metricas);
    } else {
      setAviso('No interceptaste ninguna baliza verde en el Bloque 1. Probá de nuevo.');
    }
  }, [baselineMs, liberarRecursos, onTerminar]);

  const dibujarEscena = useCallback((ctx, ahora) => {
    const m = motorRef.current;
    const video = videoRef.current;
    const transcurridoMs = ahora - m.inicioMs;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (m.modoCamara && video && video.readyState >= 2) {
      ctx.save();
      ctx.globalAlpha = m.fase === 'esperando_dedo' || m.fase === 'cuenta_regresiva' ? 0.42 : 0.28;
      ctx.translate(CANVAS_W, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, CANVAS_W, CANVAS_H);
      ctx.restore();
    }

    // Rejilla HUD de cabina.
    ctx.strokeStyle = 'rgba(91, 200, 245, 0.1)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(CANVAS_W / 2, 0);
    ctx.lineTo(CANVAS_W / 2, CANVAS_H);
    ctx.moveTo(0, CANVAS_H / 2);
    ctx.lineTo(CANVAS_W, CANVAS_H / 2);
    ctx.stroke();

    if (m.fase === 'esperando_dedo' || m.fase === 'cuenta_regresiva') {
      dibujarCalibracion(ctx, m, ahora);
      return;
    }

    if (m.fase === 'bloque1') {
      if (m.baliza) {
        const b = m.baliza;
        const edad = ahora - b.spawnMs;
        const pulso = 1 + Math.sin(edad / 120) * 0.06;
        ctx.save();
        ctx.beginPath();
        ctx.arc(b.x, b.y, RADIO_BALIZA * pulso, 0, Math.PI * 2);
        if (b.tipo === 'go') {
          ctx.fillStyle = 'rgba(74, 222, 128, 0.25)';
          ctx.strokeStyle = '#4ade80';
        } else {
          ctx.fillStyle = 'rgba(248, 113, 113, 0.28)';
          ctx.strokeStyle = '#f87171';
        }
        ctx.lineWidth = 3.5;
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = b.tipo === 'go' ? '#4ade80' : '#f87171';
        ctx.font = '700 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.tipo === 'go' ? 'GO' : 'NO-GO', b.x, b.y);
        ctx.restore();
      }

      dibujarReticle(ctx, m.reticle);
    } else if (m.fase === 'bloque2') {
      const tB2 = Math.max(0, transcurridoMs - DURACION_BLOQUE1_S * 1000);
      const objetivoYaw = 22 * Math.sin((tB2 / 2200) * Math.PI * 2);

      // Diana central fija para fijación ocular (VOR).
      ctx.save();
      ctx.beginPath();
      ctx.arc(CANVAS_W / 2, CANVAS_H / 2 - 28, 26, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(91, 200, 245, 0.2)';
      ctx.strokeStyle = '#5bc8f5';
      ctx.lineWidth = 3;
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#e8edf7';
      ctx.beginPath();
      ctx.arc(CANVAS_W / 2, CANVAS_H / 2 - 28, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = '600 18px sans-serif';
      ctx.fillStyle = '#9aa6c4';
      ctx.textAlign = 'center';
      ctx.fillText(
        m.modoCamara ? 'Mantené la vista en el punto central y girá la cabeza' : 'Seguí el marcador azul suavemente con el puntero',
        CANVAS_W / 2,
        42,
      );

      // Barra inferior de horizonte / ángulo yaw.
      const barraY = CANVAS_H - 86;
      const barraW = 520;
      const barraX0 = (CANVAS_W - barraW) / 2;
      ctx.strokeStyle = '#26325a';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(barraX0, barraY);
      ctx.lineTo(barraX0 + barraW, barraY);
      ctx.stroke();

      const mapX = (deg) => CANVAS_W / 2 + clamp(deg / 30, -1, 1) * (barraW / 2);
      const objX = mapX(objetivoYaw);

      ctx.fillStyle = '#5bc8f5';
      ctx.beginPath();
      ctx.arc(objX, barraY, 16, 0, Math.PI * 2);
      ctx.fill();

      const realDeg = m.modoCamara
        ? m.cabezaVivo.yawDeg
        : ((m.reticle.x - CANVAS_W / 2) / (barraW / 2)) * 30;
      const realX = mapX(realDeg);
      const enZona = Math.abs(realDeg - objetivoYaw) <= 10;

      ctx.fillStyle = enZona ? '#4ade80' : '#facc15';
      ctx.beginPath();
      ctx.arc(realX, barraY, 11, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#e8edf7';
      ctx.font = '700 18px monospace';
      ctx.fillText(
        m.modoCamara
          ? `Yaw: ${realDeg >= 0 ? '+' : ''}${realDeg.toFixed(0)}°  ${m.cabezaVivo.ojosAbiertos ? '· Ojos OK' : '· Abrí ojos'}`
          : `Seguimiento: ${enZona ? 'Alineado' : 'Ajustando'}`,
        CANVAS_W / 2,
        barraY + 40,
      );
      ctx.restore();
    }

    if (m.flash && ahora < m.flash.hastaMs) {
      ctx.save();
      ctx.fillStyle = m.flash.color;
      ctx.font = '700 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(m.flash.texto, m.flash.x, m.flash.y);
      ctx.restore();
    }
  }, []);

  const ejecutarCiclo = useCallback(
    (ahora) => {
      const m = motorRef.current;
      if (m.fase === 'inactivo' || m.fase === 'cargando') return;

      const video = videoRef.current;
      if (m.modoCamara && video && video.readyState >= 2 && video.currentTime !== m.ultimoVideoT) {
        m.ultimoVideoT = video.currentTime;
        if (
          (m.fase === 'esperando_dedo' || m.fase === 'cuenta_regresiva' || m.fase === 'bloque1') &&
          m.handLandmarker
        ) {
          actualizarManoDesdeVideo(m, video, ahora);
        } else if (m.fase === 'bloque2' && m.faceLandmarker) {
          const resCara = m.faceLandmarker.detectForVideo(video, ahora);
          const ori = calcularOrientacionCabeza(resCara?.faceLandmarks?.[0]);
          const ojo = extraerEstadoOcular(resCara?.faceBlendshapes);
          if (ori) {
            m.cabezaVivo = {
              yawDeg: ori.yawDeg,
              ojosAbiertos: ojo ? ojo.ojosAbiertos : true,
            };
          }
        }
      }

      if (m.fase === 'esperando_dedo' || m.fase === 'cuenta_regresiva') {
        const paso = avanzarCalibracionDedo(m.calibracion, {
          dedoDetectado: m.reticle.detectada,
          ahoraMs: ahora,
        });
        m.calibracion = paso.estado;
        m.progresoCuenta = paso.progreso;

        if (paso.iniciarTest) {
          m.fase = 'bloque1';
          m.inicioMs = ahora;
          m.proximoSpawnMs = ahora + 600;
          m.ultimoVorSampleMs = 0;
          m.ultimaUiMs = ahora;
          m.cuentaUi = null;
          setRestante(DURACION_PVT_S);
          setFase('bloque1');
          setPistaVivo('Dedo detectado · interceptá GO, evitá NO-GO');
        } else {
          const cambioFase = m.fase !== paso.estado.fase;
          if (cambioFase) {
            m.fase = paso.estado.fase;
            setFase(paso.estado.fase);
          }
          if (paso.segundosRestantes !== m.cuentaUi) {
            m.cuentaUi = paso.segundosRestantes;
            if (paso.segundosRestantes != null) setCuentaRegresiva(paso.segundosRestantes);
          }
          if (cambioFase || ahora - m.ultimaUiMs >= 200) {
            m.ultimaUiMs = ahora;
            if (m.fase === 'esperando_dedo') {
              setPistaVivo(
                m.calibracion.dedoPerdido
                  ? 'Se perdió el dedo · volvé a mostrar tu índice frente a la cámara'
                  : 'Mostrá tu dedo índice frente a la cámara para iniciar la cuenta regresiva',
              );
            } else {
              setPistaVivo(`Dedo detectado · el test comienza en ${paso.segundosRestantes} s`);
            }
          }

          const canvas = canvasRef.current;
          const ctx = canvas?.getContext('2d');
          if (ctx) dibujarEscena(ctx, ahora);

          m.raf = requestAnimationFrame(ejecutarCiclo);
          return;
        }
      }

      const transcurridoMs = ahora - m.inicioMs;
      const quedanS = Math.max(0, Math.ceil((DURACION_PVT_S * 1000 - transcurridoMs) / 1000));

      if (transcurridoMs >= DURACION_PVT_S * 1000) {
        finalizarTest();
        return;
      }

      if (m.fase === 'bloque1' && transcurridoMs >= DURACION_BLOQUE1_S * 1000) {
        m.fase = 'bloque2';
        m.baliza = null;
        setFase('bloque2');
      }

      if (m.fase === 'bloque1') {
        if (!m.baliza && ahora >= m.proximoSpawnMs && transcurridoMs < DURACION_BLOQUE1_S * 1000 - 900) {
          const pos = generarPosicionBaliza(m.reticle.x, m.reticle.y);
          const tipo = m.eventos.filter((e) => e.tipo === 'ok').length > 0 && Math.random() < 0.25 ? 'nogo' : 'go';
          m.baliza = {
            tipo,
            x: pos.x,
            y: pos.y,
            spawnMs: ahora,
            prevPos: { x: m.reticle.x, y: m.reticle.y },
            spawnDist: Math.hypot(pos.x - m.reticle.x, pos.y - m.reticle.y),
            distRecorrida: 0,
            rtInicioMs: null,
          };
        }

        if (m.baliza) {
          const b = m.baliza;
          const edad = ahora - b.spawnMs;
          b.distRecorrida += Math.hypot(m.reticle.x - b.prevPos.x, m.reticle.y - b.prevPos.y);
          b.prevPos = { x: m.reticle.x, y: m.reticle.y };

          const distObjetivo = Math.hypot(b.x - m.reticle.x, b.y - m.reticle.y);
          if (b.tipo === 'go' && b.rtInicioMs == null && distObjetivo <= b.spawnDist - 24) {
            const lat = Math.round(edad);
            if (lat >= 100) b.rtInicioMs = lat;
          }

          if (distObjetivo <= RADIO_CAPTURA) {
            if (b.tipo === 'go') {
              const capturaMs = Math.round(edad);
              const rtMs = b.rtInicioMs ?? capturaMs;
              const precisionPct = Math.round(
                clamp((Math.max(1, b.spawnDist - RADIO_CAPTURA) / Math.max(1, b.distRecorrida)) * 100, 15, 100),
              );
              m.eventos.push({ tipo: 'ok', rtMs, capturaMs, precisionPct, tsMs: Math.round(transcurridoMs) });
              m.flash = {
                texto: rtMs >= UMBRAL_LAPSO_MS ? `LAPSO ${rtMs} ms` : `${rtMs} ms`,
                color: rtMs >= UMBRAL_LAPSO_MS ? '#fb923c' : '#4ade80',
                hastaMs: ahora + 650,
                x: b.x,
                y: Math.max(36, b.y - 44),
              };
            } else {
              m.eventos.push({ tipo: 'nogo_error', tsMs: Math.round(transcurridoMs) });
              m.flash = { texto: '¡NO-GO!', color: '#f87171', hastaMs: ahora + 700, x: b.x, y: Math.max(36, b.y - 44) };
            }
            m.baliza = null;
            m.proximoSpawnMs = ahora + ISI_MIN_MS + Math.random() * (ISI_MAX_MS - ISI_MIN_MS) * 0.5;
          } else if (b.tipo === 'nogo' && edad >= 1350) {
            m.eventos.push({ tipo: 'nogo_ok', tsMs: Math.round(transcurridoMs) });
            m.baliza = null;
            m.proximoSpawnMs = ahora + 450 + Math.random() * 500;
          } else if (b.tipo === 'go' && edad >= TIMEOUT_BALIZA_MS) {
            m.eventos.push({ tipo: 'ok', rtMs: TIMEOUT_BALIZA_MS, precisionPct: 0, tsMs: Math.round(transcurridoMs) });
            m.flash = { texto: 'TIEMPO', color: '#fb923c', hastaMs: ahora + 650, x: b.x, y: Math.max(36, b.y - 44) };
            m.baliza = null;
            m.proximoSpawnMs = ahora + 450;
          }
        }
      }

      if (m.fase === 'bloque2' && ahora - m.ultimoVorSampleMs >= 80) {
        m.ultimoVorSampleMs = ahora;
        const tB2 = Math.max(0, transcurridoMs - DURACION_BLOQUE1_S * 1000);
        const objetivoYawDeg = 22 * Math.sin((tB2 / 2200) * Math.PI * 2);
        const barraW = 520;
        const yawMedido = m.modoCamara
          ? m.cabezaVivo.yawDeg
          : ((m.reticle.x - CANVAS_W / 2) / (barraW / 2)) * 30;
        m.vorMuestras.push({
          tMs: Math.round(tB2),
          yawDeg: yawMedido,
          objetivoYawDeg: Number(objetivoYawDeg.toFixed(1)),
          ojosAbiertos: m.modoCamara ? m.cabezaVivo.ojosAbiertos : true,
        });
      }

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) dibujarEscena(ctx, ahora);

      if (ahora - m.ultimaUiMs >= 200) {
        m.ultimaUiMs = ahora;
        setRestante(quedanS);
        if (m.fase === 'bloque1') {
          setPistaVivo(
            m.modoCamara
              ? m.reticle.detectada
                ? 'Mano detectada · interceptá GO, evitá NO-GO'
                : 'Mostrá la mano frente a la cámara (o mové el puntero)'
              : 'Llevá la mira a las balizas verdes GO · evitá las rojas NO-GO',
          );
        } else {
          setPistaVivo(
            m.modoCamara
              ? 'Mirá el punto central y girá la cabeza siguiendo el círculo azul'
              : 'Seguí el marcador azul suavemente con el puntero',
          );
        }
      }

      m.raf = requestAnimationFrame(ejecutarCiclo);
    },
    [dibujarEscena, finalizarTest],
  );

  async function iniciar(conCamara) {
    liberarRecursos();
    setAviso('');
    setErrorCamara('');

    const m = motorRef.current;
    m.eventos = [];
    m.vorMuestras = [];
    m.baliza = null;
    m.flash = null;
    m.ultimoVideoT = -1;
    m.calibracion = crearEstadoCalibracion();
    m.cuentaUi = null;
    m.progresoCuenta = 0;
    m.reticle = { x: CANVAS_W / 2, y: CANVAS_H / 2, detectada: false };
    m.cabezaVivo = { yawDeg: 0, ojosAbiertos: true };

    if (conCamara) {
      setFase('cargando');
      m.fase = 'cargando';
      try {
        silenciarLogsMediaPipe();
        const { FilesetResolver, FaceLandmarker, HandLandmarker } = await import('@mediapipe/tasks-vision');
        const vision = await FilesetResolver.forVisionTasks(WASM);

        const crearMano = (delegate) =>
          HandLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODELO_MANO, delegate },
            runningMode: 'VIDEO',
            numHands: 1,
          });
        const crearCara = (delegate) =>
          FaceLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODELO_CARA, delegate },
            runningMode: 'VIDEO',
            numFaces: 1,
            outputFaceBlendshapes: true,
          });

        const [hand, face] = await Promise.all([
          crearMano('GPU').catch(() => crearMano('CPU')),
          crearCara('GPU').catch(() => crearCara('CPU')),
        ]);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        });

        m.handLandmarker = hand;
        m.faceLandmarker = face;
        m.stream = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.error('Error iniciando cámara PVT:', err);
        liberarRecursos();
        setFase('inactivo');
        m.fase = 'inactivo';
        setErrorCamara('No se pudo abrir la cámara o cargar MediaPipe. Podés usar el modo sin cámara.');
        return;
      }

      m.modoCamara = true;
      m.fase = 'esperando_dedo';
      m.inicioMs = 0;
      m.ultimoVorSampleMs = 0;
      m.ultimaUiMs = 0;

      setModoCamara(true);
      setRestante(DURACION_PVT_S);
      setCuentaRegresiva(CUENTA_REGRESIVA_S);
      setFase('esperando_dedo');
      setPistaVivo('Mostrá tu dedo índice frente a la cámara para iniciar la cuenta regresiva');
      m.raf = requestAnimationFrame(ejecutarCiclo);
      return;
    }

    const ahora = performance.now();
    m.modoCamara = false;
    m.fase = 'bloque1';
    m.inicioMs = ahora;
    m.proximoSpawnMs = ahora + 600;
    m.ultimoVorSampleMs = 0;
    m.ultimaUiMs = 0;

    setModoCamara(false);
    setRestante(DURACION_PVT_S);
    setFase('bloque1');
    m.raf = requestAnimationFrame(ejecutarCiclo);
  }

  function moverPuntero(e) {
    const m = motorRef.current;
    if (m.modoCamara && (m.fase === 'esperando_dedo' || m.fase === 'cuenta_regresiva')) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = clamp(((e.clientX - rect.left) / rect.width) * CANVAS_W, 0, CANVAS_W);
    const y = clamp(((e.clientY - rect.top) / rect.height) * CANVAS_H, 0, CANVAS_H);
    m.reticle.x = x;
    m.reticle.y = y;
  }

  const evalResultado =
    resultado?.medianaMs != null
      ? evaluarIndicador('reaction_ms', resultado.medianaMs, baselineMs != null ? { reaction_ms: baselineMs } : {})
      : null;
  const ensayosValidos = (resultado?.ensayos || []).filter((e) => e.rtMs != null);

  const etiquetaReloj =
    fase === 'esperando_dedo'
      ? 'Esperando dedo'
      : fase === 'cuenta_regresiva'
        ? `Inicio en ${cuentaRegresiva} s`
        : `${restante} s`;

  const modalAbierto = fase !== 'inactivo' && typeof document !== 'undefined';

  return (
    <>
      <Card titulo="Test Cognitivo & Vestibular · 30 s" className={className}>
        <video ref={videoRef} playsInline muted className={styles.videoOculto} aria-hidden="true" />

        <p className={styles.texto}>
          15 s de <strong>pilotaje Go/No-Go</strong> (mano en el aire o puntero) + 15 s de{' '}
          <strong>estabilidad vestibular VOR</strong> (giro suave de cabeza con ojos al centro). Se abre en pantalla ampliada.
        </p>
        <div className={styles.acciones}>
          <button type="button" className={`${styles.boton} ${styles.primario}`} onClick={() => iniciar(true)}>
            📷 Con cámara (Mano + VOR)
          </button>
          <button type="button" className={styles.boton} onClick={() => iniciar(false)}>
            🖱️ Sin cámara (Mouse / Táctil)
          </button>
        </div>
        {errorCamara && <p className={styles.error}>{errorCamara}</p>}

        {resultado && (
          <div className={styles.pvtResumen}>
            {evalResultado && (
              <div className={styles.pvtHeader}>
                <span className={`${styles.pvtBadge} ${styles[`nivel_${evalResultado.level}`]}`}>
                  {ETIQUETA_NIVEL[evalResultado.level]}
                </span>
                {resultado.deltaBaseMs != null && (
                  <span className={styles.nota}>
                    {resultado.deltaBaseMs >= 0 ? `+${resultado.deltaBaseMs}` : resultado.deltaBaseMs} ms vs. base ({baselineMs} ms)
                  </span>
                )}
              </div>
            )}

            <div className={styles.pvtGrid}>
              <div className={styles.pvtDato}>
                <span>Mediana RT</span>
                <strong>{resultado.medianaMs} ms</strong>
              </div>
              <div className={styles.pvtDato}>
                <span>Lapsos (≥355 ms)</span>
                <strong>{resultado.lapsos}</strong>
              </div>
              <div className={styles.pvtDato}>
                <span>Precisión / No-Go</span>
                <strong>
                  {resultado.precisionPct != null ? `${resultado.precisionPct} %` : '—'} · {resultado.erroresNoGo} err
                </strong>
              </div>
              <div className={styles.pvtDato}>
                <span>Estabilidad VOR</span>
                <strong>{resultado.estabilidadVor != null ? `${resultado.estabilidadVor} %` : '—'}</strong>
              </div>
            </div>

            <p className={styles.nota}>
              Desempeño global: <strong>{resultado.score} %</strong> · {resultado.intentos} balizas ·{' '}
              {resultado.modoEntrada === 'camara' ? 'Modo cámara' : 'Modo puntero'}
            </p>

            {onMareo && (
              <div className={styles.pvtMareo}>
                <span className={styles.nota}>¿Mareo durante el giro?</span>
                <div className={styles.acciones}>
                  {[
                    [0, 'No'],
                    [1, 'Leve'],
                    [2, 'Moderado'],
                  ].map(([val, txt]) => (
                    <button
                      key={val}
                      type="button"
                      className={`${styles.botonMini} ${mareo === val ? styles.botonMiniActivo : ''}`}
                      onClick={() => onMareo(val)}
                    >
                      {txt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {ensayosValidos.length > 1 && (
              <div className={styles.pvtGrafico} aria-label="Tiempos de reacción por baliza">
                <ResponsiveContainer width="100%" height={110}>
                  <BarChart data={ensayosValidos} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                    <XAxis dataKey="n" stroke="var(--color-texto-suave)" fontSize={11} tickLine={false} />
                    <YAxis domain={[0, 'dataMax + 80']} stroke="var(--color-texto-suave)" fontSize={11} tickLine={false} />
                    <Tooltip
                      formatter={(v) => [`${v} ms`, 'RT']}
                      labelFormatter={(n) => `Baliza #${n}`}
                      contentStyle={{
                        background: 'var(--color-superficie-2)',
                        border: '1px solid var(--color-borde)',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <ReferenceLine y={UMBRAL_LAPSO_MS} stroke="var(--color-naranja)" strokeDasharray="3 3" />
                    <Bar dataKey="rtMs" radius={[3, 3, 0, 0]}>
                      {ensayosValidos.map((entry) => (
                        <Cell
                          key={entry.n}
                          fill={entry.lapso ? 'var(--color-naranja)' : 'var(--color-verde)'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {aviso && !resultado && <p className={styles.error}>{aviso}</p>}
      </Card>

      {modalAbierto &&
        createPortal(
          <div className={styles.pvtModalBackdrop} role="dialog" aria-modal="true" aria-label="Test Cognitivo y Vestibular">
            <div className={styles.pvtModal}>
              <div className={styles.pvtModalHeader}>
                <div className={styles.pvtModalTitulo}>
                  <span className={styles.pvtFaseTag}>{TITULO_FASE[fase] ?? ''}</span>
                  {fase !== 'cargando' && <strong className={styles.pvtReloj}>{etiquetaReloj}</strong>}
                </div>
                <button type="button" className={styles.boton} onClick={cancelar}>
                  ✕ Cerrar (Esc)
                </button>
              </div>

              {fase === 'cargando' ? (
                <div className={styles.pvtModalCargando}>
                  <p className={styles.texto}>Cargando modelos de mano y rostro (MediaPipe)…</p>
                </div>
              ) : (
                <>
                  <div className={styles.pvtModalLienzo}>
                    <canvas
                      ref={canvasRef}
                      width={CANVAS_W}
                      height={CANVAS_H}
                      className={styles.pvtCanvasModal}
                      onPointerMove={moverPuntero}
                      onPointerDown={moverPuntero}
                    />
                  </div>
                  <p className={styles.pvtModalPista}>
                    {pistaVivo || (modoCamara ? 'Seguimiento activo por cámara' : 'Mové el puntero sobre el panel')}
                  </p>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
