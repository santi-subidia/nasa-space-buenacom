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
import styles from './Cognitivos.module.scss';

const TESTS = [
  {
    id: 'reaccion',
    icono: '/figma/salud/brain.svg',
    titulo: 'Attention and balance',
    duracion: '30 s',
    mide: 'Reaction time, attention lapses, and gaze stability when turning your head.',
    porque: 'Sleep loss and vestibular gravity adaptation affect piloting and fine motor tasks.',
  },
  {
    id: 'vision',
    icono: '/figma/salud/target.svg',
    titulo: 'Visual acuity',
    duracion: '1–2 min',
    mide: 'How many E-chart levels you can distinguish at arm’s length from the screen.',
    porque: 'Spaceflight-associated neuro-ocular syndrome (SANS) can gradually alter vision on long missions.',
  },
];

// Ejercicios cognitivos: test Go/No-Go + VOR y test visual SANS, con guardado propio.
export default function Cognitivos() {
  const { astronauta, solActual } = useEstadoMision();
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
        sol: solActual,
        source: reaccion.modoEntrada === 'camara' ? 'camera' : 'manual',
        note: formatearNotaPvt(reaccion),
      });
    }
    if (vision) nuevas.push({ indicator: 'visual_acuity', value: vision.puntos, sol: solActual });

    try {
      if (nuevas.length) await guardarLecturas(nuevas);
      if (reaccion && mareo > 0) {
        await guardarSintoma({ bodyZone: 'inner_ear', code: 'dizzy_standing', severity: mareo, sol: solActual });
      }
      if (vision?.borrosa) {
        await guardarSintoma({ bodyZone: 'eyes', code: 'blurred_vision', severity: 2, sol: solActual });
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

  const resumen = [reaccion && 'attention and balance', vision && 'visual acuity'].filter(Boolean).join(' and ');

  return (
    <PantallaVyta
      titulo="Cognitive exercises"
      subtitulo={`Attention, balance & vision · Sol ${solActual}`}
      icono="/figma/nav-actividad.svg"
      acciones={
        <Link href="/actividad" className={styles.volver}>
          ← Activity
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
              <dt>What it measures</dt>
              <dd>{t.mide}</dd>
              <dt>Why in space</dt>
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
          {estado === 'guardando' ? 'Saving…' : 'Save results'}
        </button>
        <span className={styles.nota} aria-live="polite">
          {estado === 'error'
            ? 'Could not save on this device. Please try again.'
            : estado === 'guardado'
              ? 'Results saved. You can view them in Trends and your daily check-in.'
              : nada
                ? 'Complete at least one test to save the result.'
                : `Will save ${resumen}${vision?.borrosa ? ' and the symptom "blurred vision"' : ''}.`}
        </span>
      </div>
    </PantallaVyta>
  );
}
