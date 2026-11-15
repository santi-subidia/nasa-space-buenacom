'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { crearComoMeVes } from '@/ai/cara/cliente.js';
import { analizarParpadeos } from '@/ai/cara/parpadeo.js';
import { crearVoz } from '@/ai/vega/voz.js';
import { extraerCierreBlendshapes } from '@/lib/cara/blendshapes';
import { estimarPulsoRppg, extraerMuestraRppg } from '@/lib/cara/rppg';
import { guardarAviso } from '@/lib/datos/avisos';
import { cargarFotoBase, capturarImagenJpeg, guardarFotoBase } from '@/lib/datos/cara';
import { guardarLecturas } from '@/lib/datos/lecturas';
import { getMissionState, guardarChequeoFacial } from '@/lib/db';
import { SOL_ACTUAL } from '@/lib/demo/generador';
import { silenciarLogsMediaPipe } from '@/lib/mediapipe/silenciarLogs';

const WASM = '/mediapipe/wasm';
const MODELO_CARA =
  process.env.NEXT_PUBLIC_FACE_MODEL_URL ||
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

function cargarImagenDesdeArchivo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      try {
        const res = await capturarImagenJpeg(img, img.naturalWidth, img.naturalHeight);
        URL.revokeObjectURL(url);
        if (!res) reject(new Error('Could not process the image.'));
        else resolve(res);
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read the image file.'));
    };
    img.src = url;
  });
}

/**
 * Conecta webcam + MediaPipe Face Landmarker (`eyeBlinkLeft`/`Right`) + foto base (`baselinePhotoId`)
 * + `crearComoMeVes()` (`tipo: 'face'`).
 */
export function useCara({ astronautId, sol }) {
  const videoRef = useRef(null);
  const motorRef = useRef({});
  const vozVegaRef = useRef(null);
  const analisisRef = useRef(0);

  const [camaraEstado, setCamaraEstado] = useState('inactiva'); // inactiva | cargando | activa | error
  const [errorCamara, setErrorCamara] = useState('');
  const [rostroDetectado, setRostroDetectado] = useState(false);
  const [segundosMedidos, setSegundosMedidos] = useState(0);
  const [parpadeoEnVivo, setParpadeoEnVivo] = useState(null);
  const [pulsoEnVivo, setPulsoEnVivo] = useState(null);
  const [guardandoPulso, setGuardandoPulso] = useState(false);
  const [pulsoGuardado, setPulsoGuardado] = useState(false);

  const [fotoBase, setFotoBase] = useState(null); // { id, foto: {media_type, data}, url }
  const [fotoHoy, setFotoHoy] = useState(null); // { foto: {media_type, data}, url }
  const [consentimiento, setConsentimiento] = useState(false);
  const [vozActiva, setVozActiva] = useState(true);
  const vozActivaRef = useRef(true);

  const [analizando, setAnalizando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [chequeoGuardado, setChequeoGuardado] = useState(false);
  const [avisoEnviado, setAvisoEnviado] = useState(false);
  const [errorAccion, setErrorAccion] = useState('');

  const r = motorRef.current;

  useEffect(() => {
    vozActivaRef.current = vozActiva;
    if (!vozActiva) vozVegaRef.current?.callar();
  }, [vozActiva]);

  const apagarCamara = useCallback(() => {
    cancelAnimationFrame(r.raf);
    r.stream?.getTracks().forEach((t) => t.stop());
    r.stream = null;
    r.landmarker?.close?.();
    r.landmarker = null;
    setCamaraEstado('inactiva');
    setRostroDetectado(false);
  }, [r]);

  useEffect(() => {
    vozVegaRef.current = crearVoz();
    let vivo = true;
    setFotoBase(null);
    setFotoHoy(null);
    setResultado(null);
    setChequeoGuardado(false);
    setConsentimiento(false);
    setAnalizando(false);
    setErrorAccion('');
    setParpadeoEnVivo(null);
    setPulsoEnVivo(null);
    setSegundosMedidos(0);
    r.muestras = [];
    r.muestrasRppg = [];
    cargarFotoBase(astronautId).then((guardada) => {
      if (!vivo || !guardada) return;
      const url = URL.createObjectURL(guardada.blob);
      setFotoBase({ id: guardada.id, foto: guardada.foto, url });
    });
    return () => {
      vivo = false;
      analisisRef.current++;
      apagarCamara();
      vozVegaRef.current?.callar();
    };
  }, [apagarCamara, astronautId, sol, r]);

  useEffect(() => () => fotoBase?.url && URL.revokeObjectURL(fotoBase.url), [fotoBase?.url]);
  useEffect(() => () => fotoHoy?.url && URL.revokeObjectURL(fotoHoy.url), [fotoHoy?.url]);

  function bucle() {
    const video = videoRef.current;
    if (!r.landmarker || !video) return;
    if (video.readyState >= 2 && video.currentTime !== r.ultimoTiempo) {
      r.ultimoTiempo = video.currentTime;
      const ahora = performance.now();
      const deteccion = r.landmarker.detectForVideo(video, ahora);
      const cierre = extraerCierreBlendshapes(deteccion.faceBlendshapes);
      if (cierre !== null) {
        r.muestras.push({ t: ahora, cierre });
        if (r.muestras.length > 3600) r.muestras.shift();
      }
      const landmarks = deteccion.faceLandmarks?.[0];
      if (landmarks && r.canvasRppg) {
        const muestra = extraerMuestraRppg(landmarks, video, r.canvasRppg, r.centroRppg);
        if (muestra) {
          r.centroRppg = muestra.centro;
          r.muestrasRppg.push({ t: ahora, r: muestra.r, g: muestra.g, b: muestra.b, motion: muestra.motion });
          if (r.muestrasRppg.length > 600) r.muestrasRppg.shift();
        }
      } else {
        r.centroRppg = null;
      }
      if (ahora - (r.ultimaUiMs ?? 0) >= 250) {
        r.ultimaUiMs = ahora;
        setRostroDetectado(cierre !== null || Boolean(landmarks));
        if (r.muestras.length >= 2) {
          const seg = Math.floor((r.muestras.at(-1).t - r.muestras[0].t) / 1000);
          setSegundosMedidos(seg);
          if (seg >= 10) setParpadeoEnVivo(analizarParpadeos(r.muestras));
        }
      }
      if (ahora - (r.ultimoCalcRppgMs ?? 0) >= 500 && r.muestrasRppg.length >= 2) {
        r.ultimoCalcRppgMs = ahora;
        setPulsoEnVivo(estimarPulsoRppg(r.muestrasRppg));
      }
    }
    r.raf = requestAnimationFrame(bucle);
  }

  async function iniciarCamara() {
    setErrorCamara('');
    setErrorAccion('');
    setCamaraEstado('cargando');
    try {
      silenciarLogsMediaPipe();
      const { FilesetResolver, FaceLandmarker } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(WASM);
      const opciones = (delegate) => ({
        baseOptions: { modelAssetPath: MODELO_CARA, delegate },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
      });
      try {
        r.landmarker = await FaceLandmarker.createFromOptions(vision, opciones('GPU'));
      } catch {
        r.landmarker = await FaceLandmarker.createFromOptions(vision, opciones('CPU'));
      }
      r.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 960, height: 540, facingMode: 'user' },
        audio: false,
      });
      setCamaraEstado('activa');
      await new Promise((ok) => requestAnimationFrame(ok));
      videoRef.current.srcObject = r.stream;
      await videoRef.current.play();

      r.muestras = [];
      r.muestrasRppg = [];
      r.centroRppg = null;
      r.canvasRppg = r.canvasRppg || document.createElement('canvas');
      r.ultimoTiempo = -1;
      r.ultimaUiMs = 0;
      r.ultimoCalcRppgMs = 0;
      setSegundosMedidos(0);
      setParpadeoEnVivo(null);
      setPulsoEnVivo(null);
      setPulsoGuardado(false);
      bucle();
    } catch (e) {
      apagarCamara();
      setCamaraEstado('error');
      setErrorCamara(
        e?.name === 'NotAllowedError'
          ? 'Camera permission is denied. Enable it in your browser or upload a photo.'
          : e?.name === 'NotFoundError'
            ? 'No camera found. You can upload photos from your device.'
            : `Could not start the camera (${e?.message ?? 'unknown error'}). Check your connection to download the face model.`,
      );
    }
  }

  function reiniciarParpadeo() {
    r.muestras = [];
    r.muestrasRppg = [];
    r.centroRppg = null;
    r.ultimoCalcRppgMs = 0;
    setSegundosMedidos(0);
    setParpadeoEnVivo(null);
    setPulsoEnVivo(null);
    setPulsoGuardado(false);
  }

  async function guardarPulso() {
    if (!pulsoEnVivo?.bpm || pulsoEnVivo.confianza === 'baja') return;
    setErrorAccion('');
    setGuardandoPulso(true);
    try {
      const mision = await getMissionState();
      const solDestino = mision?.solActual ?? SOL_ACTUAL;
      await guardarLecturas([
        {
          indicator: 'hr_rest',
          value: pulsoEnVivo.bpm,
          sol: solDestino,
          source: 'camera',
          note: `Optical rPPG estimate (confidence ${pulsoEnVivo.confianza}, SQI ${Math.round(pulsoEnVivo.sqi * 100)} %)`,
        },
      ]);
      setPulsoGuardado(true);
    } catch (e) {
      setErrorAccion(e?.message ?? 'Could not save the pulse to the check-in.');
    } finally {
      setGuardandoPulso(false);
    }
  }

  async function guardarComoBase(captura) {
    const id = await guardarFotoBase(captura.blob, astronautId);
    const url = URL.createObjectURL(captura.blob);
    setFotoBase({ id, foto: captura.foto, url });
    setResultado(null);
  }

  async function capturarBase() {
    setErrorAccion('');
    const video = videoRef.current;
    const captura = await capturarImagenJpeg(video, video?.videoWidth, video?.videoHeight);
    if (!captura) {
      setErrorAccion('Wait a moment for the camera to show video before taking the baseline photo.');
      return;
    }
    await guardarComoBase(captura);
  }

  async function capturarHoy() {
    setErrorAccion('');
    const video = videoRef.current;
    const captura = await capturarImagenJpeg(video, video?.videoWidth, video?.videoHeight);
    if (!captura) {
      setErrorAccion('Wait a moment for the camera to show video before taking today’s photo.');
      return;
    }
    const url = URL.createObjectURL(captura.blob);
    setFotoHoy({ foto: captura.foto, url });
    setResultado(null);
  }

  async function subirArchivo(destino, file) {
    if (!file) return;
    setErrorAccion('');
    try {
      const captura = await cargarImagenDesdeArchivo(file);
      if (destino === 'base') {
        await guardarComoBase(captura);
      } else {
        const url = URL.createObjectURL(captura.blob);
        setFotoHoy({ foto: captura.foto, url });
        setResultado(null);
      }
    } catch (e) {
      setErrorAccion(e?.message ?? 'Could not load that image.');
    }
  }

  async function analizar() {
    setErrorAccion('');
    if (!consentimiento) {
      setErrorAccion('Your explicit consent is required before analyzing the photos.');
      return;
    }
    if (!fotoBase?.foto || !fotoHoy?.foto) {
      setErrorAccion('You need both the baseline photo and today’s photo to compare.');
      return;
    }

    setAnalizando(true);
    const analisis = ++analisisRef.current;
    setChequeoGuardado(false);
    setAvisoEnviado(false);
    const muestras = r.muestras?.length ? [...r.muestras] : undefined;
    const vozCliente = {
      hablar: (texto) => (vozActivaRef.current ? vozVegaRef.current?.hablar(texto) : Promise.resolve()),
    };

    try {
      const res = await crearComoMeVes({ voz: vozCliente }).observar({
        fotoBase: fotoBase.foto,
        fotoHoy: fotoHoy.foto,
        consentimiento: true,
        muestrasParpadeo: muestras,
      });
      if (analisisRef.current === analisis) setResultado(res);
      await guardarChequeoFacial({ astronautId, sol, resultado: res });
      if (analisisRef.current !== analisis) return;
      setChequeoGuardado(true);
      apagarCamara();
    } catch (e) {
      if (analisisRef.current === analisis) setErrorAccion(e?.message || 'Could not save the facial check-in. Analyze again to retry.');
    } finally {
      if (analisisRef.current === analisis) setAnalizando(false);
    }
  }

  function avisarOficial() {
    if (!resultado) return;
    guardarAviso({
      nivel: 'alta',
      categoria: 'cara',
      motivo: resultado.resumen,
      origen: 'cara',
    });
    setAvisoEnviado(true);
  }

  return {
    videoRef,
    camaraEstado,
    errorCamara,
    rostroDetectado,
    segundosMedidos,
    parpadeoEnVivo,
    pulsoEnVivo,
    guardandoPulso,
    pulsoGuardado,
    fotoBase,
    fotoHoy,
    consentimiento,
    setConsentimiento,
    vozActiva,
    setVozActiva,
    analizando,
    resultado,
    chequeoGuardado,
    avisoEnviado,
    errorAccion,
    iniciarCamara,
    apagarCamara,
    reiniciarParpadeo,
    guardarPulso,
    capturarBase,
    capturarHoy,
    subirArchivo,
    analizar,
    avisarOficial,
  };
}
