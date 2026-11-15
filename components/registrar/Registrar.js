'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Card from '@/components/Card';
import PantallaVyta from '@/components/layout/PantallaVyta';
import { INFO, CARAS } from '@/lib/content/indicadores';
import { useLecturas } from '@/lib/datos/lecturas';
import { eliminarFoto, guardarFoto } from '@/lib/datos/sintomas';
import { useCheckinDiario } from '@/lib/datos/checkin';
import { guardarCheckinDiario } from '@/lib/db';
import { SOL_ACTUAL } from '@/lib/mock/mision';
import { WATCH, valoresDelDia } from '@/lib/mock/indicadores';
import FotoPiel from './FotoPiel';
import styles from './Registrar.module.scss';

// Rango válido de cada campo editable.
const LIMITES = {
  bp_sys: [60, 260],
  bp_dia: [30, 160],
  hr_rest: [30, 220],
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
  const checkin = useCheckinDiario();
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
    return Number.isNaN(n) || n < min || n > max ? `Entre ${min} y ${max}` : null;
  };
  const hayError = Object.keys(LIMITES).some((k) => error(k));

  const cambios = Object.keys(LIMITES).filter(
    (k) => edit[k] !== undefined && edit[k] !== '' && !error(k),
  );
  const nada = cambios.length === 0 && !foto;

  async function guardar(e) {
    e.preventDefault();
    if (nada || hayError || guardandoRef.current || checkin.cargando || checkin.completado || checkin.error) return;
    guardandoRef.current = true;
    setGuardando(true);
    setErrorGuardado(null);

    const nuevas = cambios.map((k) => ({ indicator: k, value: num(edit[k]), sol: SOL_ACTUAL }));

    let photoBlobId = null;
    let conservarFoto = false;
    try {
      if (foto) {
        photoBlobId = await guardarFoto(foto.blob);
      }
      const resultado = await guardarCheckinDiario({
        astronautId: checkin.astronautId,
        sol: SOL_ACTUAL,
        lecturas: nuevas,
        sintoma: foto ? { bodyZone: 'immune', code: foto.code, severity: foto.severity, photoBlobId } : null,
      });
      conservarFoto = resultado.guardado;
      router.push('/');
    } catch (err) {
      console.error(err);
      setErrorGuardado('No se pudo guardar en este equipo. Probá de nuevo.');
      guardandoRef.current = false;
      setGuardando(false);
    } finally {
      if (photoBlobId && !conservarFoto) await eliminarFoto(photoBlobId).catch(console.error);
    }
  }

  return (
    <PantallaVyta
      titulo="Check-in diario"
      subtitulo={`Chequeo matutino · Sol ${SOL_ACTUAL}`}
      icono="/figma/nav-registrar.svg"
    >
      {checkin.cargando ? <p role="status" className={styles.texto}>Consultando el check-in de hoy…</p> : checkin.completado ? (
        <Card className={styles.completado}>
          <span className={styles.tickCompletado} aria-hidden="true">✓</span>
          <div><h2>Check-in de hoy completado</h2><p>Ya guardaste tu chequeo diario. Podés registrar el próximo a partir de mañana.</p></div>
          <Link href="/" className={`${styles.boton} ${styles.primario}`}>Volver a Vista General</Link>
        </Card>
      ) : <div className={styles.cuerpo}>
        <form className={styles.form} onSubmit={guardar} noValidate>
          {checkin.error && <p className={styles.error} role="alert">{checkin.error}</p>}
          <fieldset className={styles.campos} disabled={guardando || Boolean(checkin.error)}>
          <Card titulo="Mediciones del día">
            <Fila id="presion" etiqueta="Presión arterial">
              <div className={styles.par}>
                <Numero k="bp_sys" label="Sistólica" valor={valor('bp_sys')} onChange={cambiar} error={error('bp_sys')} />
                <span>/</span>
                <Numero k="bp_dia" label="Diastólica" valor={valor('bp_dia')} onChange={cambiar} error={error('bp_dia')} />
                <span className={styles.unidad}>mmHg</span>
              </div>
            </Fila>

            <Fila id="hr_rest" etiqueta="Frecuencia cardíaca">
              <Numero k="hr_rest" label="Frecuencia cardíaca" valor={valor('hr_rest')} onChange={cambiar} error={error('hr_rest')} />
              <span className={styles.unidad}>lpm</span>
              {base.hr_rest?.hoy && base.hr_rest?.source === 'camera' && (
                <span className={styles.camaraBadge}>📷 Cámara</span>
              )}
              <Link href="/cara" className={styles.boton}>
                Medir con cámara
              </Link>
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
              {errorGuardado
                ? errorGuardado
                : hayError
                ? 'Revisá los valores marcados.'
                : nada
                  ? 'No hay cambios para guardar.'
                  : `Se ${cambios.length === 1 ? 'guardará 1 lectura' : `guardarán ${cambios.length} lecturas`}${foto ? ' y 1 foto' : ''}.`}
            </span>
          </div>
          </fieldset>
        </form>

        <div className={styles.lateral}>
          <Card titulo="¿Cómo me veo hoy?" acento="ia">
            <p className={styles.texto}>
              Compará tu cara de hoy con tu foto base: parpadeo para detectar fatiga, pulso por cámara y una observación de Vega.
            </p>
            <Link href="/cara" className={`${styles.boton} ${styles.primario}`}>
              <span aria-hidden="true">📷</span> Abrir chequeo facial
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
