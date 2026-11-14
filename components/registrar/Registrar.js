'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Card from '@/components/Card';
import { INFO, CARAS } from '@/lib/content/indicadores';
import { useLecturas, guardarLecturas } from '@/lib/datos/lecturas';
import { guardarFoto, guardarSintoma } from '@/lib/datos/sintomas';
import { SOL_ACTUAL } from '@/lib/mock/mision';
import { META, WATCH, valoresDelDia } from '@/lib/mock/indicadores';
import FotoPiel from './FotoPiel';
import TestReaccion from './TestReaccion';
import styles from './Registrar.module.scss';

// Rango válido de cada campo editable.
const LIMITES = {
  bp_sys: [60, 260],
  bp_dia: [30, 160],
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
  const lecturas = useLecturas();
  const base = valoresDelDia(lecturas, SOL_ACTUAL);

  const [edit, setEdit] = useState({}); // solo lo que se tocó: { clave: texto }
  const [foto, setFoto] = useState(null); // { blob, code, severity }
  const [reaccion, setReaccion] = useState(null); // { ms, intentos }
  const [guardando, setGuardando] = useState(false);

  // Valor mostrado = lo editado o, si no, lo medido hoy.
  const valor = (k) => edit[k] ?? (base[k]?.hoy ? String(base[k].valor) : '');
  const cambiar = (k, v) => setEdit((e) => ({ ...e, [k]: v }));

  const error = (k) => {
    if (edit[k] === undefined || edit[k] === '') return null;
    const n = num(edit[k]);
    const [min, max] = LIMITES[k];
    return Number.isNaN(n) || n < min || n > max ? `Entre ${min} y ${max}` : null;
  };
  const hayError = Object.keys(LIMITES).some((k) => error(k));

  const cambios = Object.keys(LIMITES).filter(
    (k) => edit[k] !== undefined && edit[k] !== '' && !error(k) && num(edit[k]) !== base[k]?.valor,
  );
  const nada = cambios.length === 0 && !foto && !reaccion;

  async function guardar(e) {
    e.preventDefault();
    if (nada || hayError) return;
    setGuardando(true);

    const nuevas = cambios.map((k) => ({
      indicator: k,
      value: num(edit[k]),
      unit: META[k].unidad,
      sol: SOL_ACTUAL,
    }));
    if (reaccion) nuevas.push({ indicator: 'reaction_ms', value: reaccion.ms, unit: 'ms', sol: SOL_ACTUAL });
    if (nuevas.length) guardarLecturas(nuevas);

    if (foto) {
      const photoBlobId = await guardarFoto(foto.blob);
      guardarSintoma({ bodyZone: 'immune', code: foto.code, severity: foto.severity, sol: SOL_ACTUAL, photoBlobId });
    }
    router.push('/');
  }

  return (
    <div className={styles.pantalla}>
      <header className={styles.encabezado}>
        <div>
          <h1>Registrar</h1>
          <p className={styles.sub}>Chequeo matutino · Sol {SOL_ACTUAL}</p>
        </div>
        <Link href="/vega?modo=chequeo" className={`${styles.boton} ${styles.ia}`}>
          🎙 Completar por voz
        </Link>
      </header>

      <div className={styles.cuerpo}>
        <form className={styles.form} onSubmit={guardar} noValidate>
          <Card>
            <Fila id="presion" etiqueta="Presión arterial">
              <div className={styles.par}>
                <Numero k="bp_sys" label="Sistólica" valor={valor('bp_sys')} onChange={cambiar} error={error('bp_sys')} />
                <span>/</span>
                <Numero k="bp_dia" label="Diastólica" valor={valor('bp_dia')} onChange={cambiar} error={error('bp_dia')} />
                <span className={styles.unidad}>mmHg</span>
              </div>
            </Fila>

            <Fila id="hr_rest" etiqueta="Frecuencia cardíaca" watch>
              <span className={styles.watch}>⌚ Watch</span>
              <input className={styles.campo} value={WATCH.hr_rest} readOnly aria-label="Frecuencia cardíaca (del Watch)" />
              <span className={styles.unidad}>lpm</span>
            </Fila>

            <Fila id="glucose" etiqueta="Glucosa">
              <Numero k="glucose" label="Glucosa" valor={valor('glucose')} onChange={cambiar} error={error('glucose')} />
              <span className={styles.unidad}>mg/dL</span>
            </Fila>

            <Fila id="temp" etiqueta="Temperatura">
              <Numero k="temp" label="Temperatura" valor={valor('temp')} onChange={cambiar} error={error('temp')} />
              <span className={styles.unidad}>°C</span>
            </Fila>

            <Fila id="sleep_h" etiqueta="Sueño">
              <input
                type="range"
                min="0"
                max="12"
                step="0.5"
                className={styles.rango}
                aria-label="Horas de sueño"
                value={valor('sleep_h') || 7}
                onChange={(e) => cambiar('sleep_h', e.target.value)}
              />
              <strong className={styles.valorRango}>{String(valor('sleep_h') || '—').replace('.', ',')} h</strong>
            </Fila>

            <Fila id="spo2" etiqueta="SpO₂" watch>
              <span className={styles.watch}>⌚ Watch</span>
              <input className={styles.campo} value={WATCH.spo2} readOnly aria-label="SpO₂ (del Watch)" />
              <span className={styles.unidad}>%</span>
            </Fila>

            <Fila id="water_ml" etiqueta="Agua">
              <Numero k="water_ml" label="Agua" valor={valor('water_ml')} onChange={cambiar} error={error('water_ml')} />
              <span className={styles.unidad}>ml</span>
              <button type="button" className={styles.boton} onClick={() => setEdit((e) => ({ ...e, water_ml: String((Number(e.water_ml ?? valor('water_ml')) || 0) + 250) }))}>
                + 250 ml
              </button>
            </Fila>

            <Fila id="stress" etiqueta="Estrés">
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                className={styles.rango}
                aria-label="Estrés de 1 a 10"
                value={valor('stress') || 5}
                onChange={(e) => cambiar('stress', e.target.value)}
              />
              <strong className={styles.valorRango}>{valor('stress') || '—'} / 10</strong>
            </Fila>

            <Fila id="mood" etiqueta="Ánimo">
              <div className={styles.caras} role="radiogroup" aria-label="Ánimo">
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
            <button type="submit" className={`${styles.boton} ${styles.primario}`} disabled={nada || hayError || guardando}>
              {guardando ? 'Guardando…' : 'Guardar chequeo'}
            </button>
            <span className={styles.nota}>
              {hayError
                ? 'Revisá los valores marcados.'
                : nada
                  ? 'No hay cambios para guardar.'
                  : `Se guardarán ${cambios.length + (reaccion ? 1 : 0)} lecturas${foto ? ' y 1 foto' : ''}.`}
            </span>
          </div>
        </form>

        <div className={styles.lateral}>
          <FotoPiel valor={foto} onChange={setFoto} />
          <TestReaccion resultado={reaccion} onTerminar={setReaccion} />
        </div>
      </div>
    </div>
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
function Fila({ id, etiqueta, children, watch }) {
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
          aria-label={`Qué es ${etiqueta}`}
          onClick={() => setAbierta(!abierta)}
        >
          ⓘ
        </button>
      </div>
      {abierta && (
        <dl id={`info-${id}`} className={styles.ficha}>
          <dt>Qué es</dt>
          <dd>{info.que}</dd>
          <dt>Por qué en el espacio</dt>
          <dd>{info.espacio}</dd>
          <dt>Cómo medirlo</dt>
          <dd>{info.medir}</dd>
          <dt>Cuándo preocuparse</dt>
          <dd>{info.preocuparse}</dd>
        </dl>
      )}
    </div>
  );
}
