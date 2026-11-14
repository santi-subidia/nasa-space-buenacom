'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { crearComoMeVes } from '@/ai/cara/cliente.js';
import { analizarParpadeos } from '@/ai/cara/parpadeo.js';
import { crearVoz } from '@/ai/vega/voz.js';
import { extraerCierreBlendshapes } from '@/lib/cara/blendshapes';
import { guardarAviso } from '@/lib/datos/avisos';
import { cargarFotoBase, capturarImagenJpeg, guardarFotoBase } from '@/lib/datos/cara';
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
        if (!res) reject(new Error('No se pudo procesar la imagen.'));
        else resolve(res);
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer el archivo de imagen.'));
    };
    img.src = url;
  });
}

/**
 * Conecta webcam + MediaPipe Face Landmarker (`eyeBlinkLeft`/`Right`) + foto base (`baselinePhotoId`)
 * + `crearComoMeVes()` (`tipo: 'face'`).
 */
export function useCara() {
  const videoRef = useRef(null);
  const motorRef = useRef({});
  const vozVegaRef = useRef(null);

  const [camaraEstado, setCamaraEstado] = useState('inactiva'); // inactiva | cargando | activa | error
  const [errorCamara, setErrorCamara] = useState('');
  const [rostroDetectado, setRostroDetectado] = useState(false);
  const [segundosMedidos, setSegundosMedidos] = useState(0);
  const [parpadeoEnVivo, setParpadeoEnVivo] = useState(null);

  const [fotoBase, setFotoBase] = useState(null); // { id, foto: {media_type, data}, url }
  const [fotoHoy, setFotoHoy] = useState(null); // { foto: {media_type, data}, url }
  const [consentimiento, setConsentimiento] = useState(false);
  const [vozActiva, setVozActiva] = useState(true);
  const vozActivaRef = useRef(true);

  const [analizando, setAnalizando] = useState(false);
  const [resultado, setResultado] = useState(null);
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
    cargarFotoBase().then((guardada) => {
      if (!vivo || !guardada) return;
      const url = URL.createObjectURL(guardada.blob);
      setFotoBase({ id: guardada.id, foto: guardada.foto, url });
    });
    return () => {
      vivo = false;
      apagarCamara();
      vozVegaRef.current?.callar();
    };
  }, [apagarCamara]);

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
      if (ahora - (r.ultimaUiMs ?? 0) >= 250) {
        r.ultimaUiMs = ahora;
        setRostroDetectado(cierre !== null);
        if (r.muestras.length >= 2) {
          const seg = Math.floor((r.muestras.at(-1).t - r.muestras[0].t) / 1000);
          setSegundosMedidos(seg);
          if (seg >= 10) setParpadeoEnVivo(analizarParpadeos(r.muestras));
        }
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
      r.ultimoTiempo = -1;
      r.ultimaUiMs = 0;
      setSegundosMedidos(0);
      setParpadeoEnVivo(null);
      bucle();
    } catch (e) {
      apagarCamara();
      setCamaraEstado('error');
      setErrorCamara(
        e?.name === 'NotAllowedError'
          ? 'No hay permiso para usar la cámara. Habilitala en el navegador o subí una foto.'
          : e?.name === 'NotFoundError'
            ? 'No se encontró ninguna cámara. Podés subir las fotos desde tu equipo.'
            : `No se pudo iniciar la cámara (${e?.message ?? 'error desconocido'}). Revisá la conexión para descargar el modelo facial.`,
      );
    }
  }

  function reiniciarParpadeo() {
    r.muestras = [];
    setSegundosMedidos(0);
    setParpadeoEnVivo(null);
  }

  async function guardarComoBase(captura) {
    const id = await guardarFotoBase(captura.blob);
    const url = URL.createObjectURL(captura.blob);
    setFotoBase({ id, foto: captura.foto, url });
    setResultado(null);
  }

  async function capturarBase() {
    setErrorAccion('');
    const video = videoRef.current;
    const captura = await capturarImagenJpeg(video, video?.videoWidth, video?.videoHeight);
    if (!captura) {
      setErrorAccion('Esperá un instante a que la cámara muestre imagen antes de sacar la foto base.');
      return;
    }
    await guardarComoBase(captura);
  }

  async function capturarHoy() {
    setErrorAccion('');
    const video = videoRef.current;
    const captura = await capturarImagenJpeg(video, video?.videoWidth, video?.videoHeight);
    if (!captura) {
      setErrorAccion('Esperá un instante a que la cámara muestre imagen antes de sacar la foto de hoy.');
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
      setErrorAccion(e?.message ?? 'No se pudo cargar esa imagen.');
    }
  }

  async function analizar() {
    setErrorAccion('');
    if (!consentimiento) {
      setErrorAccion('Necesitamos tu consentimiento explícito antes de analizar las fotos.');
      return;
    }
    if (!fotoBase?.foto || !fotoHoy?.foto) {
      setErrorAccion('Necesitás la foto base y la foto de hoy para comparar.');
      return;
    }

    setAnalizando(true);
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
      setResultado(res);
      apagarCamara();
    } finally {
      setAnalizando(false);
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
    fotoBase,
    fotoHoy,
    consentimiento,
    setConsentimiento,
    vozActiva,
    setVozActiva,
    analizando,
    resultado,
    avisoEnviado,
    errorAccion,
    iniciarCamara,
    apagarCamara,
    reiniciarParpadeo,
    capturarBase,
    capturarHoy,
    subirArchivo,
    analizar,
    avisarOficial,
  };
}
