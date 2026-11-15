'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Card from '@/components/Card';
import PantallaVyta from '@/components/layout/PantallaVyta';
import { INFO, CARAS } from '@/lib/content/indicadores';
import { eliminarFoto, guardarFoto } from '@/lib/datos/sintomas';
import { useCheckinPorSol } from '@/lib/datos/checkin';
import { guardarCheckinPorSol } from '@/lib/db';
import { useEstadoMision } from '@/lib/datos/demo';
import { valoresDelDia } from '@/lib/datos/indicadores';
import FotoPiel from './FotoPiel';
import styles from './Registrar.module.scss';

// Rango válido de cada campo editable.
const LIMITES = {
  bp_sys: [60, 260],
  bp_dia: [30, 160],
  hr_rest: [30, 220],
  spo2: [70, 100],
  glucose: [30, 500],
  temp: [33, 43],
  sleep_h: [0, 16],
  water_ml: [0, 6000],
  stress: [1, 10],
  mood: [1, 5],
};

const num = (s) => Number(String(s).replace(',', '.'));

export default function Registrar() {
  const router = useRouter();
  const { lecturas, solActual, cargando } = useEstadoMision();
  const base = valoresDelDia(lecturas, solActual);
  const checkin = useCheckinPorSol(cargando ? null : solActual);
  const guardandoRef = useRef(false);

  const [edit, setEdit] = useState({}); // solo lo que se tocó: { clave: texto }
  const [foto, setFoto] = useState(null); // { blob, code, severity }
  const [guardando, setGuardando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState(null);

  // Valor mostrado = lo editado o, si no, lo medido hoy.
  const valor = (k) => edit[k] ?? (base[k]?.hoy ? String(base[k].valor) : '');
  const cambiar = (k, v) => setEdit((e) => ({ ...e, [k]: v }));

  const error = (k) => {
    if (edit[k] === undefined || edit[k] === '') return null;
    const n = num(edit[k]);
    const [min, max] = LIMITES[k];
    return Number.isNaN(n) || n < min || n > max ? `Between ${min} and ${max}` : null;
  };
  const hayError = Object.keys(LIMITES).some((k) => error(k));

  const cambios = Object.keys(LIMITES).filter(
    (k) => edit[k] !== undefined && edit[k] !== '' && !error(k),
  );

  async function guardar(e) {
    e.preventDefault();
    if (hayError || guardandoRef.current || checkin.cargando || checkin.completado || checkin.error || !checkin.facialCompletado) return;
    guardandoRef.current = true;
    setGuardando(true);
    setErrorGuardado(null);

    const nuevas = cambios.map((k) => ({ indicator: k, value: num(edit[k]), sol: solActual }));

    let photoBlobId = null;
    let conservarFoto = false;
    try {
      if (foto) {
        photoBlobId = await guardarFoto(foto.blob);
      }
      const resultado = await guardarCheckinPorSol({
        astronautId: checkin.astronautId,
        sol: solActual,
        lecturas: nuevas,
        sintoma: foto ? { bodyZone: 'immune', code: foto.code, severity: foto.severity, photoBlobId } : null,
      });
      conservarFoto = resultado.guardado;
      router.push('/');
    } catch (err) {
      console.error(err);
      setErrorGuardado(err?.message || 'Could not save on this device. Please try again.');
      guardandoRef.current = false;
      setGuardando(false);
    } finally {
      if (photoBlobId && !conservarFoto) await eliminarFoto(photoBlobId).catch(console.error);
    }
  }

  return (
    <PantallaVyta
      titulo="Check-in by sol"
      subtitulo={`One check-in per sol · Sol ${solActual}`}
      icono="/figma/nav-registrar.svg"
    >
      {checkin.cargando ? <p role="status" className={styles.texto}>Checking current sol check-in…</p> : checkin.completado ? (
        <Card className={styles.completado}>
          <span className={styles.tickCompletado} aria-hidden="true">✓</span>
          <div><h2>Sol {solActual} check-in completed</h2><p>You have already saved your check-in for this sol. You can log the next one when the mission sol advances.</p></div>
          <Link href="/" className={`${styles.boton} ${styles.primario}`}>Back to Overview</Link>
        </Card>
      ) : <div className={styles.cuerpo}>
        <form className={styles.form} onSubmit={guardar} noValidate>
          {checkin.error && <p className={styles.error} role="alert">{checkin.error}</p>}
          <fieldset className={styles.campos} disabled={guardando || Boolean(checkin.error)}>
          <Card titulo={`Sol ${solActual} Measurements`}>
            <Fila id="presion" etiqueta="Blood pressure">
              <div className={styles.par}>
                <Numero k="bp_sys" label="Systolic" valor={valor('bp_sys')} onChange={cambiar} error={error('bp_sys')} />
                <span>/</span>
                <Numero k="bp_dia" label="Diastolic" valor={valor('bp_dia')} onChange={cambiar} error={error('bp_dia')} />
                <span className={styles.unidad}>mmHg</span>
              </div>
            </Fila>

            <Fila id="hr_rest" etiqueta="Heart rate">
              <Numero k="hr_rest" label="Heart rate" valor={valor('hr_rest')} onChange={cambiar} error={error('hr_rest')} />
              <span className={styles.unidad}>bpm</span>
              {base.hr_rest?.hoy && base.hr_rest?.source === 'camera' && (
                <span className={styles.camaraBadge}>📷 Camera</span>
              )}
              <Link href="/cara" className={styles.boton}>
                Measure with camera
              </Link>
            </Fila>

            <Fila id="glucose" etiqueta="Glucose">
              <Numero k="glucose" label="Glucose" valor={valor('glucose')} onChange={cambiar} error={error('glucose')} />
              <span className={styles.unidad}>mg/dL</span>
            </Fila>

            <Fila id="temp" etiqueta="Temperature">
              <Numero k="temp" label="Temperature" valor={valor('temp')} onChange={cambiar} error={error('temp')} />
              <span className={styles.unidad}>°C</span>
            </Fila>

            <Fila id="sleep_h" etiqueta="Sleep">
              <input
                type="range"
                min="0"
                max="12"
                step="0.5"
                className={styles.rango}
                aria-label="Hours of sleep"
                value={valor('sleep_h') || 7}
                onChange={(e) => cambiar('sleep_h', e.target.value)}
              />
              <strong className={styles.valorRango}>{String(valor('sleep_h') || '—')} h</strong>
            </Fila>

            <Fila id="spo2" etiqueta="SpO₂">
              <Numero k="spo2" label="SpO₂" valor={valor('spo2') || (base.spo2 ? String(base.spo2.valor) : '')} onChange={cambiar} error={error('spo2')} />
              <span className={styles.unidad}>%</span>
            </Fila>

            <Fila id="water_ml" etiqueta="Water">
              <Numero k="water_ml" label="Water" valor={valor('water_ml')} onChange={cambiar} error={error('water_ml')} />
              <span className={styles.unidad}>ml</span>
              <button type="button" className={styles.boton} onClick={() => setEdit((e) => ({ ...e, water_ml: String((Number(e.water_ml ?? valor('water_ml')) || 0) + 250) }))}>
                + 250 ml
              </button>
            </Fila>

            <Fila id="stress" etiqueta="Stress">
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                className={styles.rango}
                aria-label="Stress from 1 to 10"
                value={valor('stress') || 5}
                onChange={(e) => cambiar('stress', e.target.value)}
              />
              <strong className={styles.valorRango}>{valor('stress') || '—'} / 10</strong>
            </Fila>

            <Fila id="mood" etiqueta="Mood">
              <div className={styles.caras} role="radiogroup" aria-label="Mood">
                {CARAS.map((c) => (
                  <button
                    key={c.valor}
                    type="button"
                    role="radio"
                    aria-checked={Number(valor('mood')) === c.valor}
                    aria-label={`${c.valor}: ${c.texto}`}
                    title={c.texto}
                    className={Number(valor('mood')) === c.valor ? styles.cara + ' ' + styles.elegida : styles.cara}
                    onClick={() => cambiar('mood', String(c.valor))}
                  >
                    {c.emoji}
                  </button>
                ))}
              </div>
            </Fila>
          </Card>

          <div className={styles.pie}>
            <button type="submit" className={`${styles.boton} ${styles.primario}`} disabled={!checkin.facialCompletado || hayError || guardando}>
              {guardando ? 'Saving…' : 'Save check-in'}
            </button>
            <span className={styles.nota}>
              {errorGuardado
                ? errorGuardado
                : hayError
                ? 'Review the highlighted values.'
                : !checkin.facialCompletado
                  ? `Complete "How do I look today" for Sol ${solActual} before saving.`
                  : `Will save check-in for Sol ${solActual}${cambios.length ? ` with ${cambios.length} ${cambios.length === 1 ? 'reading' : 'readings'}` : ''}${foto ? ' and 1 photo' : ''}.`}
            </span>
          </div>
          </fieldset>
        </form>

        <div className={styles.lateral}>
          <Card titulo="How do I look today?" acento="ia">
            <p className={styles.texto}>
              Compare your face with your baseline photo and complete the facial analysis. It is required to save each sol’s check-in.
            </p>
            <p className={styles.texto} role="status">{checkin.facialCompletado ? `✓ Facial check-in completed · Sol ${solActual}` : `Pending · Sol ${solActual}`}</p>
            <Link href="/cara" className={`${styles.boton} ${styles.primario}`}>
              <span aria-hidden="true">📷</span> Open facial check-in
            </Link>
          </Card>
          <FotoPiel valor={foto} onChange={setFoto} />
        </div>
      </div>}
    </PantallaVyta>
  );
}

function Numero({ k, label, valor, onChange, error }) {
  return (
    <span className={styles.numero}>
      <input
        className={`${styles.campo} ${error ? styles.invalido : ''}`}
        inputMode="decimal"
        aria-label={label}
        aria-invalid={!!error}
        value={valor}
        onChange={(e) => onChange(k, e.target.value)}
      />
      {error && <small className={styles.error}>{error}</small>}
    </span>
  );
}

// Una fila del formulario con su botón ⓘ (qué es, por qué en el espacio, cómo medirlo, cuándo preocuparse).
function Fila({ id, etiqueta, children }) {
  const [abierta, setAbierta] = useState(false);
  const info = INFO[id];
  return (
    <div className={styles.fila}>
      <div className={styles.filaTop}>
        <span className={styles.etiqueta}>{etiqueta}</span>
        <div className={styles.controles}>{children}</div>
        <button
          type="button"
          className={styles.info}
          aria-expanded={abierta}
          aria-controls={`info-${id}`}
          aria-label={`What is ${etiqueta}`}
          onClick={() => setAbierta(!abierta)}
        >
          ⓘ
        </button>
      </div>
      {abierta && (
        <dl id={`info-${id}`} className={styles.ficha}>
          <dt>What it is</dt>
          <dd>{info.que}</dd>
          <dt>Why in space</dt>
          <dd>{info.espacio}</dd>
          <dt>How to measure</dt>
          <dd>{info.medir}</dd>
          <dt>When to be concerned</dt>
          <dd>{info.preocuparse}</dd>
        </dl>
      )}
    </div>
  );
}
