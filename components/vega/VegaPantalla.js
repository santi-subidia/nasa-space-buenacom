'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/Card';
import { SUGERENCIAS } from '@/ai/vega/sesion.js';
import { useTripulanteActivo } from '@/lib/datos/tripulante';
import { TRIPULANTES } from '@/lib/demo/generador';
import { INDICADORES } from '@/lib/tipos';
import { useChequeo } from './useChequeo';
import { useVega } from './useVega';
import styles from './VegaPantalla.module.scss';

const ESTADOS = {
  inactivo: 'Tocá el micrófono para hablar',
  escuchando: 'Escuchando…',
  pensando: 'Pensando…',
  hablando: 'Hablando… tocá para callarme',
};

// El chequeo tiene una fase más ("preguntando": Vega lee la pregunta) que en pantalla es "hablando".
const FASE_DEL_CHEQUEO = { preguntando: 'hablando', escuchando: 'escuchando', pensando: 'pensando', completo: 'inactivo', inactivo: 'inactivo' };

const ORIGENES = {
  guardada: 'Respuesta guardada: ahora no puedo consultar a la IA',
  local: 'Respuesta de la app, sin IA',
};

const ESTADO_PASO = {
  hecho: { icono: '✓', texto: 'hecho' },
  actual: { icono: '▶', texto: 'ahora' },
  omitido: { icono: '–', texto: 'omitido' },
  pendiente: { icono: '○', texto: 'pendiente' },
};

function estadoDelPaso(paso, chequeo) {
  if (paso.indicadores.every((id) => chequeo.hechos[id])) return 'hecho';
  if (chequeo.omitidos.includes(paso.id)) return 'omitido';
  if (chequeo.pasoActual === paso.id) return 'actual';
  return 'pendiente';
}

function valorDelPaso(paso, hechos) {
  const lecturas = paso.indicadores.map((id) => hechos[id]).filter(Boolean);
  if (!lecturas.length) return '';
  const unidad = INDICADORES[lecturas[0].indicator]?.unidad ?? '';
  return `${lecturas.map((l) => String(l.value).replace('.', ',')).join('/')} ${unidad}`.trim();
}

export default function VegaPantalla({ modoInicial = 'conversar' }) {
  const activoId = useTripulanteActivo();
  const nombreTripulante = TRIPULANTES.find((t) => t.id === activoId)?.name || 'Ana Ríos';
  const vega = useVega();
  const chequeo = useChequeo(vega.voz);
  const [modo, setModo] = useState(modoInicial);
  const [texto, setTexto] = useState('');
  const fin = useRef(null);

  const enChequeo = modo === 'chequeo';
  const fase = enChequeo ? FASE_DEL_CHEQUEO[chequeo.fase] : vega.fase;
  const mensajes = enChequeo ? chequeo.mensajes : vega.mensajes;
  const ocupada = vega.fase === 'pensando';
  const chequeoEnCurso = !['inactivo', 'completo'].includes(chequeo.fase);
  const error = enChequeo ? chequeo.error : vega.error;
  const soportaVoz = vega.soportaVoz;

  useEffect(() => {
    fin.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [mensajes.length, fase]);

  function cambiarModo(nuevo) {
    if (nuevo === modo) return;
    vega.cancelar();
    chequeo.cancelar();
    setModo(nuevo);
  }

  function enviar(evento) {
    evento.preventDefault();
    const pregunta = texto.trim();
    if (!pregunta || ocupada) return;
    setTexto('');
    vega.preguntar(pregunta);
  }

  function tocarMicrofono() {
    if (enChequeo) {
      if (chequeoEnCurso) chequeo.cancelar();
      else chequeo.iniciar();
    } else if (vega.fase === 'inactivo') vega.preguntarPorVoz();
    else vega.cancelar();
  }

  const micActivo = enChequeo ? chequeoEnCurso : vega.fase !== 'inactivo';

  return (
    <div className={styles.pantalla}>
      <header className={styles.encabezado}>
        <div>
          <h1>{enChequeo ? 'Chequeo por voz' : 'Hablar con Vega'}</h1>
          <p className={styles.sub}>
            {enChequeo
              ? 'Vega te pregunta y completa el chequeo con lo que le digas.'
              : 'Preguntale por voz o escribiendo. Te respondo con fuentes de la NASA.'}
          </p>
        </div>
        <div className={styles.modos} role="group" aria-label="Modo">
          <button type="button" aria-pressed={!enChequeo} onClick={() => cambiarModo('conversar')}>
            Conversar
          </button>
          <button type="button" aria-pressed={enChequeo} onClick={() => cambiarModo('chequeo')}>
            🎙 Chequeo por voz
          </button>
        </div>
      </header>

      <div className={styles.cuerpo}>
        <Card acento="ia" className={styles.conversacion} aria-label="Conversación con Vega">
          <ol className={styles.mensajes} role="log" aria-live="polite">
            {mensajes.length === 0 && (
              <li className={`${styles.burbuja} ${styles.vega}`}>
                <span className={styles.quien}>Vega</span>
                <p>
                  {enChequeo
                    ? `Hola ${nombreTripulante}. Te voy a preguntar, de a una cosa: presión, temperatura, ánimo y estrés. Contestame en voz alta con los números; si querés saltear un paso, decí “después”. Tocá el micrófono para empezar.`
                    : `Hola ${nombreTripulante}, soy Vega. Puedo explicarte cómo viene tu cuerpo hoy, qué significan tus números y qué hacer. Preguntame lo que quieras.`}
                </p>
              </li>
            )}
            {mensajes.map((m, i) => (
              <Mensaje key={m.id ?? i} mensaje={m} />
            ))}
            {!enChequeo && ocupada && (
              <li className={`${styles.burbuja} ${styles.vega} ${styles.pensandoBurbuja}`} aria-label="Vega está pensando">
                <span /><span /><span />
              </li>
            )}
            <li ref={fin} aria-hidden="true" />
          </ol>
        </Card>

        <aside className={styles.lateral} aria-label="Controles de Vega">
          <Card titulo="Voz" className={styles.voz}>
            <button
              type="button"
              className={`${styles.mic} ${styles[fase]}`}
              onClick={tocarMicrofono}
              disabled={!vega.listo || !chequeo.listo || !soportaVoz || (!enChequeo && ocupada)}
              aria-label={micActivo ? 'Detener' : enChequeo ? 'Empezar el chequeo por voz' : 'Hablar con Vega'}
              aria-pressed={micActivo}
            >
              <span aria-hidden="true">{micActivo ? '■' : '🎙'}</span>
            </button>

            <div className={`${styles.ondas} ${styles[fase]}`} aria-hidden="true">
              {Array.from({ length: 7 }, (_, i) => (
                <span key={i} style={{ animationDelay: `${i * 90}ms` }} />
              ))}
            </div>

            <p className={styles.estado} role="status">
              {enChequeo && !chequeoEnCurso ? (chequeo.fase === 'completo' ? 'Chequeo terminado' : 'Tocá el micrófono para empezar') : ESTADOS[fase]}
            </p>
            {!enChequeo && vega.parcial && <p className={styles.parcial}>“{vega.parcial}”</p>}
            {error && <p className={styles.error} role="alert">{error}</p>}
            {!soportaVoz && (
              <p className={styles.nota}>
                Este navegador no reconoce la voz. Usá Chrome para hablar{enChequeo ? ' o completá el chequeo en Registrar.' : ', o escribí la pregunta abajo.'}
              </p>
            )}
          </Card>

          {enChequeo ? (
            <Card titulo="Pasos del chequeo">
              <ol className={styles.pasos}>
                {chequeo.pasos.map((paso) => {
                  const estado = estadoDelPaso(paso, chequeo);
                  const { icono, texto: etiqueta } = ESTADO_PASO[estado];
                  return (
                    <li key={paso.id} className={`${styles.paso} ${styles[`paso_${estado}`]}`}>
                      <span className={styles.iconoPaso} aria-hidden="true">{icono}</span>
                      <span className={styles.nombrePaso}>{nombreDelPaso(paso)}</span>
                      <span className={styles.valorPaso}>{valorDelPaso(paso, chequeo.hechos)}</span>
                      <span className={styles.oculto}> ({etiqueta})</span>
                    </li>
                  );
                })}
              </ol>
              <p className={styles.nota}>Cada valor se guarda apenas lo decís. Podés corregirlo en Registrar.</p>
              <Link className={styles.enlace} href="/registrar">Ver en Registrar →</Link>
            </Card>
          ) : (
            <Card titulo="Probá preguntar">
              <ul className={styles.sugerencias}>
                {SUGERENCIAS.map((s) => (
                  <li key={s}>
                    <button type="button" onClick={() => vega.preguntar(s)} disabled={ocupada || !vega.listo}>
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <button
            type="button"
            className={`${styles.avisar} ${vega.sugerirAviso ? styles.destacado : ''}`}
            onClick={vega.avisarOficial}
            disabled={!vega.listo}
          >
            <span aria-hidden="true">◆</span> Avisar al oficial médico
          </button>
        </aside>
      </div>

      {!enChequeo && (
        <form className={styles.escribir} onSubmit={enviar}>
          <label htmlFor="pregunta-vega" className={styles.oculto}>Escribile una pregunta a Vega</label>
          <input
            id="pregunta-vega"
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="O escribile tu pregunta…"
            maxLength={500}
            autoComplete="off"
          />
          <button type="submit" disabled={!texto.trim() || ocupada || !vega.listo}>Enviar</button>
        </form>
      )}

      <p className={styles.aviso}>
        Vega orienta con información de la NASA; no diagnostica ni reemplaza al oficial médico. Prototipo educativo.
      </p>
    </div>
  );
}

const NOMBRES_DE_PASO = { presion: 'Presión arterial', temperatura: 'Temperatura', animo: 'Ánimo', estres: 'Estrés' };
const nombreDelPaso = (paso) => NOMBRES_DE_PASO[paso.id] ?? paso.id;

function Mensaje({ mensaje }) {
  const esVega = mensaje.rol === 'vega';
  const origen = esVega ? ORIGENES[mensaje.origen] : null;
  return (
    <li className={`${styles.burbuja} ${esVega ? styles.vega : styles.usuario} ${mensaje.urgente ? styles.urgente : ''}`}>
      <span className={styles.quien}>{esVega ? 'Vega' : 'Vos'}</span>
      {mensaje.urgente && (
        <span className={styles.etiqueta}>
          <span aria-hidden="true">◆</span> Aviso importante
        </span>
      )}
      <p>{mensaje.texto}</p>
      {origen && <span className={styles.origen}>{origen}</span>}
      {mensaje.citas?.length > 0 && (
        <ul className={styles.citas} aria-label="Fuentes">
          {mensaje.citas.map((c) => (
            <li key={c.id}>
              <a href={c.url} target="_blank" rel="noopener noreferrer" title={c.titulo}>
                <span className={styles.idCita}>{c.id}</span> {c.titulo}
              </a>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
