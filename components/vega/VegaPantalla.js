'use client';

import { useEffect, useRef, useState } from 'react';
import Card from '@/components/Card';
import { SUGERENCIAS } from '@/ai/vega/sesion.js';
import { MISION } from '@/lib/mock/mision';
import { useVega } from './useVega';
import styles from './VegaPantalla.module.scss';

const ESTADOS = {
  inactivo: 'Tocá el micrófono para hablar',
  escuchando: 'Escuchando…',
  pensando: 'Pensando…',
  hablando: 'Hablando… tocá para callarme',
};

const ORIGENES = {
  guardada: 'Respuesta guardada: ahora no puedo consultar a la IA',
  local: 'Respuesta de la app, sin IA',
};

export default function VegaPantalla() {
  const vega = useVega();
  const [texto, setTexto] = useState('');
  const fin = useRef(null);
  const ocupada = vega.fase === 'pensando';

  useEffect(() => {
    fin.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [vega.mensajes.length, vega.fase]);

  function enviar(evento) {
    evento.preventDefault();
    const pregunta = texto.trim();
    if (!pregunta || ocupada) return;
    setTexto('');
    vega.preguntar(pregunta);
  }

  function tocarMicrofono() {
    if (vega.fase === 'inactivo') vega.preguntarPorVoz();
    else vega.cancelar();
  }

  return (
    <div className={styles.pantalla}>
      <header className={styles.encabezado}>
        <h1>Hablar con Vega</h1>
        <p className={styles.sub}>Preguntale por voz o escribiendo. Te respondo con fuentes de la NASA.</p>
      </header>

      <div className={styles.cuerpo}>
        <Card acento="ia" className={styles.conversacion} aria-label="Conversación con Vega">
          <ol className={styles.mensajes} role="log" aria-live="polite">
            {vega.mensajes.length === 0 && (
              <li className={`${styles.burbuja} ${styles.vega}`}>
                <span className={styles.quien}>Vega</span>
                <p>
                  Hola {MISION.astronauta.nombre}, soy Vega. Puedo explicarte cómo viene tu cuerpo hoy, qué significan tus
                  números y qué hacer. Preguntame lo que quieras.
                </p>
              </li>
            )}
            {vega.mensajes.map((m) => (
              <Mensaje key={m.id} mensaje={m} />
            ))}
            {ocupada && (
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
              className={`${styles.mic} ${styles[vega.fase]}`}
              onClick={tocarMicrofono}
              disabled={!vega.listo || !vega.soportaVoz || ocupada}
              aria-label={vega.fase === 'inactivo' ? 'Hablar con Vega' : 'Detener'}
              aria-pressed={vega.fase === 'escuchando'}
            >
              <span aria-hidden="true">{vega.fase === 'inactivo' ? '🎙' : '■'}</span>
            </button>

            <div className={`${styles.ondas} ${styles[vega.fase]}`} aria-hidden="true">
              {Array.from({ length: 7 }, (_, i) => (
                <span key={i} style={{ animationDelay: `${i * 90}ms` }} />
              ))}
            </div>

            <p className={styles.estado} role="status">{ESTADOS[vega.fase]}</p>
            {vega.parcial && <p className={styles.parcial}>“{vega.parcial}”</p>}
            {vega.error && <p className={styles.error} role="alert">{vega.error}</p>}
            {!vega.soportaVoz && (
              <p className={styles.nota}>
                Este navegador no reconoce la voz. Usá Chrome para hablar, o escribí la pregunta abajo.
              </p>
            )}
          </Card>

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

      <p className={styles.aviso}>
        Vega orienta con información de la NASA; no diagnostica ni reemplaza al oficial médico. Prototipo educativo.
      </p>
    </div>
  );
}

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
