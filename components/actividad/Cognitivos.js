'use client';

import { useState } from 'react';
import Link from 'next/link';
import PantallaVyta from '@/components/layout/PantallaVyta';
import TestReaccion from '@/components/registrar/TestReaccion';
import TestVision from '@/components/registrar/TestVision';
import { useEstadoMision } from '@/lib/datos/demo';
import { guardarLecturas } from '@/lib/datos/lecturas';
import { guardarSintoma } from '@/lib/datos/sintomas';
import { formatearNotaPvt } from '@/lib/pvt/metricas';
import { SOL_ACTUAL } from '@/lib/mock/mision';
import styles from './Cognitivos.module.scss';

const TESTS = [
  {
    id: 'reaccion',
    icono: '/figma/salud/brain.svg',
    titulo: 'Atención y equilibrio',
    duracion: '30 s',
    mide: 'Tiempo de reacción, lapsos de atención y estabilidad de la mirada al girar la cabeza.',
    porque: 'La falta de sueño y la adaptación vestibular a la gravedad afectan el pilotaje y las tareas finas.',
  },
  {
    id: 'vision',
    icono: '/figma/salud/target.svg',
    titulo: 'Agudeza visual',
    duracion: '1–2 min',
    mide: 'Cuántos niveles de la letra E distinguís a un brazo de la pantalla.',
    porque: 'El síndrome neuro-ocular (SANS) puede cambiar la visión de a poco durante misiones largas.',
  },
];

// Ejercicios cognitivos: test Go/No-Go + VOR y test visual SANS, con guardado propio.
export default function Cognitivos() {
  const { astronauta } = useEstadoMision();
  const baselineReaccion = astronauta?.baseline?.reaction_ms ?? null;

  const [reaccion, setReaccion] = useState(null);
  const [mareo, setMareo] = useState(0); // 0 = no, 1 = leve, 2 = moderado
  const [vision, setVision] = useState(null); // { puntos, niveles, borrosa }
  const [estado, setEstado] = useState('listo'); // listo | guardando | guardado | error

  const nada = !reaccion && !vision;

  async function guardar() {
    if (nada) return;
    setEstado('guardando');
    const nuevas = [];
    if (reaccion) {
      nuevas.push({
        indicator: 'reaction_ms',
        value: reaccion.ms,
        sol: SOL_ACTUAL,
        source: reaccion.modoEntrada === 'camara' ? 'camera' : 'manual',
        note: formatearNotaPvt(reaccion),
      });
    }
    if (vision) nuevas.push({ indicator: 'visual_acuity', value: vision.puntos, sol: SOL_ACTUAL });

    try {
      if (nuevas.length) await guardarLecturas(nuevas);
      if (reaccion && mareo > 0) {
        await guardarSintoma({ bodyZone: 'inner_ear', code: 'dizzy_standing', severity: mareo, sol: SOL_ACTUAL });
      }
      if (vision?.borrosa) {
        await guardarSintoma({ bodyZone: 'eyes', code: 'blurred_vision', severity: 2, sol: SOL_ACTUAL });
      }
      setReaccion(null);
      setVision(null);
      setMareo(0);
      setEstado('guardado');
    } catch (err) {
      console.error(err);
      setEstado('error');
    }
  }

  const resumen = [reaccion && 'atención y equilibrio', vision && 'agudeza visual'].filter(Boolean).join(' y ');

  return (
    <PantallaVyta
      titulo="Ejercicios cognitivos"
      subtitulo={`Atención, equilibrio y visión · Sol ${SOL_ACTUAL}`}
      icono="/figma/nav-actividad.svg"
      acciones={
        <Link href="/actividad" className={styles.volver}>
          ← Actividad
        </Link>
      }
    >
      <div className={styles.tests}>
        {TESTS.map((t) => (
          <article key={t.id} className={styles.test}>
            <header className={styles.cabecera}>
              <span className={styles.icono} aria-hidden="true">
                <img src={t.icono} width="34" height="34" alt="" />
              </span>
              <div>
                <h2>{t.titulo}</h2>
                <span className={styles.duracion}>{t.duracion}</span>
              </div>
            </header>
            <dl className={styles.ficha}>
              <dt>Qué mide</dt>
              <dd>{t.mide}</dd>
              <dt>Por qué en el espacio</dt>
              <dd>{t.porque}</dd>
            </dl>
            <div className={styles.cuerpoTest}>
              {t.id === 'reaccion' ? (
                <TestReaccion
                  className={styles.interna}
                  resultado={reaccion}
                  baselineMs={baselineReaccion}
                  mareo={mareo}
                  onMareo={setMareo}
                  onTerminar={(m) => {
                    setReaccion(m);
                    setMareo(0);
                    setEstado('listo');
                  }}
                />
              ) : (
                <TestVision
                  className={styles.interna}
                  resultado={vision}
                  onTerminar={(v) => {
                    setVision(v);
                    setEstado('listo');
                  }}
                />
              )}
            </div>
          </article>
        ))}
      </div>

      <div className={styles.pie}>
        <button type="button" className={styles.guardar} disabled={nada || estado === 'guardando'} onClick={guardar}>
          {estado === 'guardando' ? 'Guardando…' : 'Guardar resultados'}
        </button>
        <span className={styles.nota} aria-live="polite">
          {estado === 'error'
            ? 'No se pudo guardar en este equipo. Probá de nuevo.'
            : estado === 'guardado'
              ? 'Resultados guardados. Los ves en Analítica y en tu chequeo del día.'
              : nada
                ? 'Hacé al menos un test para guardar el resultado.'
                : `Se guardará el resultado de ${resumen}${vision?.borrosa ? ' y el síntoma "visión borrosa"' : ''}.`}
        </span>
      </div>
    </PantallaVyta>
  );
}
