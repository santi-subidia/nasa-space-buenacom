'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Card from '@/components/Card';
import TrafficLight from '@/components/TrafficLight';
import { EVALUAR } from '@/lib/mock/indicadores';
import styles from './Registrar.module.scss';

// Minitest de agudeza visual con "E direccional" (tumbling E), para seguir SANS en el tiempo.
// doc/nasa/riesgos/fisiologia/sans-ojos.md · doc/proyecto/sintesis/catalogo-indicadores.md (Tier 2).
// No es un examen oftalmológico: sirve para comparar contra la propia base, siempre a la misma distancia y luz.

// Tamaño de la E en px por nivel. Cada nivel superado suma 10 puntos (0–100).
export const TAMANOS_PX = [72, 54, 40, 30, 23, 17, 13, 10, 7, 5];
const INTENTOS_POR_NIVEL = 3;
const ACIERTOS_PARA_PASAR = 2;

// Hacia dónde apuntan las patas de la E y cuánto se rota (la E dibujada apunta a la derecha).
const DIRECCIONES = [
  { id: 'derecha', grados: 0, flecha: '→', tecla: 'ArrowRight' },
  { id: 'abajo', grados: 90, flecha: '↓', tecla: 'ArrowDown' },
  { id: 'izquierda', grados: 180, flecha: '←', tecla: 'ArrowLeft' },
  { id: 'arriba', grados: 270, flecha: '↑', tecla: 'ArrowUp' },
];

function otraDireccion(anterior) {
  const opciones = DIRECCIONES.filter((d) => d.id !== anterior);
  return opciones[Math.floor(Math.random() * opciones.length)].id;
}

/** Puntaje 0–100 a partir de los niveles superados. */
export function puntajeVision(nivelesSuperados) {
  return Math.round((Math.max(0, Math.min(nivelesSuperados, TAMANOS_PX.length)) / TAMANOS_PX.length) * 100);
}

export default function TestVision({ resultado, onTerminar }) {
  const [corriendo, setCorriendo] = useState(false);
  const [nivel, setNivel] = useState(0);
  const [direccion, setDireccion] = useState('derecha');
  const [borrosa, setBorrosa] = useState(resultado?.borrosa ?? false);
  const [aviso, setAviso] = useState('');
  const ronda = useRef({ intento: 0, aciertos: 0 });

  function empezar() {
    ronda.current = { intento: 0, aciertos: 0 };
    setNivel(0);
    setAviso('');
    setDireccion(otraDireccion(null));
    setCorriendo(true);
  }

  const terminar = useCallback(
    (nivelesSuperados) => {
      setCorriendo(false);
      onTerminar({ puntos: puntajeVision(nivelesSuperados), niveles: nivelesSuperados, borrosa });
    },
    [borrosa, onTerminar],
  );

  const responder = useCallback(
    (id) => {
      const r = ronda.current;
      r.intento += 1;
      if (id === direccion) r.aciertos += 1;
      setAviso(id === direccion ? '✓' : '✗');

      if (r.intento < INTENTOS_POR_NIVEL) {
        setDireccion(otraDireccion(direccion));
        return;
      }
      const paso = r.aciertos >= ACIERTOS_PARA_PASAR;
      ronda.current = { intento: 0, aciertos: 0 };
      if (!paso) return terminar(nivel);
      if (nivel + 1 >= TAMANOS_PX.length) return terminar(TAMANOS_PX.length);
      setNivel(nivel + 1);
      setDireccion(otraDireccion(direccion));
    },
    [direccion, nivel, terminar],
  );

  // Flechas del teclado mientras corre el test.
  useEffect(() => {
    if (!corriendo) return;
    const alTocar = (e) => {
      const d = DIRECCIONES.find((x) => x.tecla === e.key);
      if (!d) return;
      e.preventDefault();
      responder(d.id);
    };
    window.addEventListener('keydown', alTocar);
    return () => window.removeEventListener('keydown', alTocar);
  }, [corriendo, responder]);

  function cambiarBorrosa(valor) {
    setBorrosa(valor);
    if (resultado) onTerminar({ ...resultado, borrosa: valor });
  }

  const grados = DIRECCIONES.find((d) => d.id === direccion)?.grados ?? 0;
  const tam = TAMANOS_PX[nivel];

  return (
    <Card titulo="Test visual · SANS" id="vision">
      {!corriendo && (
        <>
          <p className={styles.texto}>
            Sentate a <strong>un brazo de la pantalla</strong>, con la misma luz de siempre y tus anteojos si usás. Indicá
            hacia dónde apuntan las patas de la <strong>E</strong>; se achica en cada nivel.
          </p>
          <label className={styles.check}>
            <input type="checkbox" checked={borrosa} onChange={(e) => cambiarBorrosa(e.target.checked)} />
            Hoy veo borroso (de lejos o de cerca)
          </label>
          <button type="button" className={styles.boton} onClick={empezar}>
            {resultado ? 'Repetir test visual' : 'Empezar test visual'}
          </button>
          {resultado && (
            <p className={styles.resultado}>
              Agudeza: <strong>{resultado.puntos} puntos</strong> ({resultado.niveles} de {TAMANOS_PX.length} niveles){' '}
              <TrafficLight nivel={EVALUAR.visual_acuity(resultado.puntos)} /> · se guarda con el chequeo
            </p>
          )}
          <p className={styles.nota}>Orienta, no diagnostica. Si la visión empeora o ves borroso, avisá al oficial médico.</p>
        </>
      )}

      {corriendo && (
        <div className={styles.test}>
          <p className={styles.texto}>
            Nivel <strong>{nivel + 1}</strong> de {TAMANOS_PX.length} · intento {ronda.current.intento + 1} de{' '}
            {INTENTOS_POR_NIVEL} <span aria-live="polite">{aviso}</span>
          </p>
          <div className={styles.lienzoVision} aria-label="Letra E rotada">
            <svg width={tam} height={tam} viewBox="0 0 5 5" style={{ transform: `rotate(${grados}deg)` }} aria-hidden="true">
              <rect x="0" y="0" width="1" height="5" />
              <rect x="0" y="0" width="5" height="1" />
              <rect x="0" y="2" width="5" height="1" />
              <rect x="0" y="4" width="5" height="1" />
            </svg>
          </div>
          <div className={styles.flechas} role="group" aria-label="Hacia dónde apunta la E">
            {DIRECCIONES.map((d) => (
              <button key={d.id} type="button" className={styles.boton} onClick={() => responder(d.id)} aria-label={d.id}>
                {d.flecha}
              </button>
            ))}
          </div>
          <button type="button" className={styles.enlace} onClick={() => terminar(nivel)}>
            No la distingo
          </button>
        </div>
      )}
    </Card>
  );
}
