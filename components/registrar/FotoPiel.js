'use client';

import { useEffect, useRef, useState } from 'react';
import Card from '@/components/Card';
import styles from './Registrar.module.scss';

const CODIGOS = [
  { id: 'rash', texto: 'Erupción' },
  { id: 'cold_sore', texto: 'Herpes labial' },
  { id: 'other', texto: 'Otra lesión' },
];

// Foto de la piel o de una lesión con la webcam. Se guarda como Symptom con photoBlobId al guardar el chequeo.
export default function FotoPiel({ valor, onChange }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [camara, setCamara] = useState(false);
  const [error, setError] = useState(null);
  const [vista, setVista] = useState(null);

  const apagar = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamara(false);
  };

  // Apaga la cámara al salir de la pantalla y libera la vista previa.
  useEffect(() => apagar, []);
  useEffect(() => () => vista && URL.revokeObjectURL(vista), [vista]);

  async function abrir() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640 }, audio: false });
      streamRef.current = stream;
      setCamara(true);
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch {
      setError('No se pudo abrir la cámara. Revisá el permiso del navegador.');
    }
  }

  function tomar() {
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setVista(URL.createObjectURL(blob));
        onChange({ blob, code: valor?.code ?? 'rash', severity: valor?.severity ?? 1 });
        apagar();
      },
      'image/jpeg',
      0.85,
    );
  }

  function quitar() {
    setVista(null);
    onChange(null);
  }

  return (
    <Card titulo="Foto de piel o lesión">
      {!camara && !valor && (
        <>
          <p className={styles.texto}>Sacá una foto con la cámara de la notebook. Se guarda en este equipo.</p>
          <button type="button" className={styles.boton} onClick={abrir}>
            📷 Abrir cámara
          </button>
        </>
      )}

      {camara && (
        <div className={styles.camara}>
          <video ref={videoRef} autoPlay playsInline muted className={styles.video} />
          <div className={styles.acciones}>
            <button type="button" className={`${styles.boton} ${styles.primario}`} onClick={tomar}>
              Tomar foto
            </button>
            <button type="button" className={styles.boton} onClick={apagar}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {valor && (
        <div className={styles.camara}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {vista && <img src={vista} alt="Foto tomada" className={styles.video} />}
          <div className={styles.acciones}>
            <select
              aria-label="Qué ves"
              className={styles.campo}
              value={valor.code}
              onChange={(e) => onChange({ ...valor, code: e.target.value })}
            >
              {CODIGOS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.texto}
                </option>
              ))}
            </select>
            <select
              aria-label="Gravedad"
              className={styles.campo}
              value={valor.severity}
              onChange={(e) => onChange({ ...valor, severity: Number(e.target.value) })}
            >
              <option value={1}>Leve</option>
              <option value={2}>Moderada</option>
              <option value={3}>Fuerte</option>
            </select>
            <button type="button" className={styles.boton} onClick={quitar}>
              Quitar
            </button>
          </div>
        </div>
      )}

      {error && <p className={styles.error} role="alert">{error}</p>}
    </Card>
  );
}
