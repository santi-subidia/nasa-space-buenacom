'use client';

import { useEffect, useRef, useState } from 'react';
import Card from '@/components/Card';
import styles from './Registrar.module.scss';

const DURACION_S = 30;

// Test de tiempo de reacción (tipo PVT): tocar cuando la pantalla pasa de rojo a verde.
export default function TestReaccion({ resultado, onTerminar }) {
  const [corriendo, setCorriendo] = useState(false);
  const [fase, setFase] = useState('espera'); // 'espera' (rojo) | 'ya' (verde)
  const [restante, setRestante] = useState(DURACION_S);
  const [aviso, setAviso] = useState('');
  const tiempos = useRef([]);
  const inicioVerde = useRef(0);
  const temporizador = useRef(null);

  const programarVerde = () => {
    setFase('espera');
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => {
      inicioVerde.current = performance.now();
      setFase('ya');
    }, 1000 + Math.random() * 2500);
  };

  function empezar() {
    tiempos.current = [];
    setAviso('');
    setRestante(DURACION_S);
    setCorriendo(true);
    programarVerde();
  }

  // Cuenta regresiva de 30 s.
  useEffect(() => {
    if (!corriendo) return;
    const fin = performance.now() + DURACION_S * 1000;
    const id = setInterval(() => {
      const quedan = Math.max(0, Math.ceil((fin - performance.now()) / 1000));
      setRestante(quedan);
      if (quedan === 0) {
        clearInterval(id);
        clearTimeout(temporizador.current);
        setCorriendo(false);
        const t = tiempos.current;
        if (t.length) {
          onTerminar({ ms: Math.round(t.reduce((a, b) => a + b, 0) / t.length), intentos: t.length });
        } else {
          setAviso('No registraste ningún toque. Probá de nuevo.');
        }
      }
    }, 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corriendo]);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  function tocar() {
    if (fase === 'ya') {
      tiempos.current.push(Math.round(performance.now() - inicioVerde.current));
      setAviso(`${tiempos.current.at(-1)} ms`);
    } else {
      setAviso('¡Muy pronto! Esperá el verde.');
    }
    programarVerde();
  }

  return (
    <Card titulo="Test de reacción · 30 s">
      {!corriendo && (
        <>
          <p className={styles.texto}>Tocá el recuadro apenas se ponga verde. Mide tu atención y cuánto descansaste.</p>
          <button type="button" className={styles.boton} onClick={empezar}>
            {resultado ? 'Repetir test de 30 s' : 'Empezar test de 30 s'}
          </button>
          {resultado && (
            <p className={styles.resultado}>
              Promedio: <strong>{resultado.ms} ms</strong> ({resultado.intentos} toques) · se guarda con el chequeo
            </p>
          )}
          {aviso && !resultado && <p className={styles.error}>{aviso}</p>}
        </>
      )}

      {corriendo && (
        <div className={styles.test}>
          <p className={styles.texto}>
            Quedan <strong>{restante} s</strong> · {aviso}
          </p>
          <button
            type="button"
            className={`${styles.pad} ${fase === 'ya' ? styles.padVerde : styles.padRojo}`}
            onPointerDown={tocar}
            aria-label={fase === 'ya' ? 'Ahora: tocá' : 'Esperá'}
          >
            {fase === 'ya' ? '¡AHORA!' : 'Esperá…'}
          </button>
        </div>
      )}
    </Card>
  );
}
