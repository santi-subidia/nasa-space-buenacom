'use client';

import { useEffect, useRef, useState } from 'react';
import Card from '@/components/Card';
import styles from './Registrar.module.scss';

const CODIGOS = [
  { id: 'rash', texto: 'Rash' },
  { id: 'cold_sore', texto: 'Cold sore' },
  { id: 'other', texto: 'Other lesion' },
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
      setError('Could not open the camera. Check browser permission.');
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
    <Card titulo="Skin or lesion photo">
      {!camara && !valor && (
        <>
          <p className={styles.texto}>Take a photo with your laptop camera. Saved locally on this device.</p>
          <button type="button" className={styles.boton} onClick={abrir}>
            📷 Open camera
          </button>
        </>
      )}

      {camara && (
        <div className={styles.camara}>
          <video ref={videoRef} autoPlay playsInline muted className={styles.video} />
          <div className={styles.acciones}>
            <button type="button" className={`${styles.boton} ${styles.primario}`} onClick={tomar}>
              Take photo
            </button>
            <button type="button" className={styles.boton} onClick={apagar}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {valor && (
        <div className={styles.camara}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {vista && <img src={vista} alt="Captured photo" className={styles.video} />}
          <div className={styles.acciones}>
            <select
              aria-label="What do you see"
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
              aria-label="Severity"
              className={styles.campo}
              value={valor.severity}
              onChange={(e) => onChange({ ...valor, severity: Number(e.target.value) })}
            >
              <option value={1}>Mild</option>
              <option value={2}>Moderate</option>
              <option value={3}>Severe</option>
            </select>
            <button type="button" className={styles.boton} onClick={quitar}>
              Remove
            </button>
          </div>
        </div>
      )}

      {error && <p className={styles.error} role="alert">{error}</p>}
    </Card>
  );
}
