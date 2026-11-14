'use client';

import { useState } from 'react';
import Link from 'next/link';
import Card from '@/components/Card';
import TrafficLight from '@/components/TrafficLight';
import { useTripulanteActivo } from '@/lib/datos/tripulante';
import { SOL_ACTUAL, TRIPULANTES } from '@/lib/demo/generador';
import { NIVELES } from '@/lib/niveles';
import { useJunta } from './useJunta';
import styles from './JuntaPantalla.module.scss';

const ESPECIALISTAS_PENSANDO = [
  'Cardiovascular',
  'Inmunidad',
  'Conducta y sueño',
  'Hueso y músculo',
  'Ambiente',
];

const MOTIVOS_GUARDADA = {
  ia_apagada: 'Modo demostración sin IA: mostrando la última junta guardada.',
  sin_clave: 'Sin clave de IA configurada: mostrando la última junta guardada.',
  red: 'Sin conexión con la IA: mostrando la última junta guardada.',
};

function formatearFecha(iso) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

export default function JuntaPantalla() {
  const activoId = useTripulanteActivo();
  const nombreTripulante = TRIPULANTES.find((t) => t.id === activoId)?.name || 'Ana Ríos';
  const { fase, vista, motivo, error, nivelMotorActual, segundos, avisoEnviado, convocar, avisarOficial } = useJunta();
  const [pestana, setPestana] = useState('astronauta');
  const pensando = fase === 'pensando';

  return (
    <div className={styles.pantalla}>
      <header className={styles.encabezado}>
        <div>
          <h1>Junta médica</h1>
          <p className={styles.sub}>
            5 especialistas analizan la última semana · Sol {SOL_ACTUAL} · {nombreTripulante}
          </p>
        </div>
        <button
          type="button"
          className={styles.botonConvocar}
          onClick={convocar}
          disabled={pensando}
        >
          {pensando ? `Consultando (${segundos} s)…` : vista ? 'Volver a convocar' : 'Convocar junta médica'}
        </button>
      </header>

      {pensando && <EstadoPensando segundos={segundos} nivelMotor={nivelMotorActual} />}

      {fase === 'error' && (
        <Card acento="orange" className={styles.errorCard}>
          <p className={styles.errorTitulo}>No pudimos completar la junta médica</p>
          <p className={styles.errorTexto}>{error}</p>
          <button type="button" className={styles.botonAcento} onClick={convocar}>
            Reintentar
          </button>
        </Card>
      )}

      {vista && !pensando && (
        <>
          {vista.guardada && (
            <div className={styles.avisoGuardada} role="status">
              <span>
                {MOTIVOS_GUARDADA[motivo] ?? 'Mostrando la última junta guardada (respaldo sin conexión con la IA).'}
                {vista.ts ? ` · Guardada el ${formatearFecha(vista.ts)}` : ''}
              </span>
            </div>
          )}

          <SintesisCard
            vista={vista}
            avisoEnviado={avisoEnviado}
            onAvisar={avisarOficial}
          />

          <section aria-label="Opinión de los 5 especialistas" className={styles.seccion}>
            <h2 className={styles.tituloSeccion}>Especialistas</h2>
            <div className={styles.especialistas}>
              {vista.especialistas.map((e) => (
                <EspecialistaCard key={e.id} especialista={e} />
              ))}
            </div>
          </section>

          <DesacuerdosCard desacuerdos={vista.desacuerdos} />

          <InformesCard
            pestanas={vista.pestanas}
            activa={pestana}
            onCambiar={setPestana}
          />
        </>
      )}

      <p className={styles.aviso}>
        La junta médica orienta con fuentes de la NASA; no diagnostica ni reemplaza al oficial médico. Prototipo educativo.
      </p>
    </div>
  );
}

function EstadoPensando({ segundos, nivelMotor }) {
  return (
    <Card acento="ia" className={styles.pensandoCard} role="status" aria-live="polite">
      <div className={styles.pensandoTop}>
        <div className={styles.puntos} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div>
          <h2>Junta médica en sesión…</h2>
          <p className={styles.pensandoSub}>
            Revisando lecturas de los últimos 7 soles, alertas y fichas de la NASA · {segundos} s (suele tardar ~24 s)
          </p>
        </div>
        <div className={styles.motorPiso}>
          <span>Piso del motor:</span>
          <TrafficLight nivel={nivelMotor} />
        </div>
      </div>

      <ul className={styles.especialistasPensando}>
        {ESPECIALISTAS_PENSANDO.map((nombre, i) => (
          <li key={nombre} style={{ animationDelay: `${i * 120}ms` }}>
            <span className={styles.especialistaNombre}>{nombre}</span>
            <span className={styles.especialistaEstado}>Analizando evidencia…</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function SintesisCard({ vista, avisoEnviado, onAvisar }) {
  const nivelMotorTxt = NIVELES[vista.nivelMotor]?.etiqueta ?? vista.nivelMotor;
  const nivelJuntaTxt = NIVELES[vista.nivelJunta]?.etiqueta ?? vista.nivelJunta;
  const nivelFinalTxt = NIVELES[vista.nivelFinal]?.etiqueta ?? vista.nivelFinal;

  return (
    <Card titulo="Síntesis del coordinador" acento={vista.nivelFinal} className={styles.sintesis}>
      <div className={styles.sintesisTop}>
        <div className={styles.sintesisNivel}>
          <TrafficLight nivel={vista.nivelFinal} />
          <span className={styles.accionPill}>{vista.accion.texto}</span>
        </div>
        <div className={styles.metaNiveles}>
          <span>Motor: {nivelMotorTxt}</span>
          <span>·</span>
          <span>Junta: {nivelJuntaTxt}</span>
        </div>
      </div>

      {vista.subioPorMotor && (
        <p className={styles.subioMotor} role="note">
          El motor de reglas subió el nivel final de <strong>{nivelJuntaTxt}</strong> a <strong>{nivelFinalTxt}</strong>: la IA nunca puede bajar una alerta del motor.
        </p>
      )}

      <p className={styles.decision}>{vista.sintesis.decision}</p>

      {vista.sintesis.razones.length > 0 && (
        <ul className={styles.razones}>
          {vista.sintesis.razones.map((r, i) => (
            <li key={`${i}-${r.slice(0, 24)}`}>{r}</li>
          ))}
        </ul>
      )}

      <div className={styles.botones}>
        <button
          type="button"
          className={`${styles.boton} ${avisoEnviado ? styles.botonHecho : styles.botonAlerta}`}
          onClick={onAvisar}
          disabled={avisoEnviado}
        >
          {avisoEnviado ? '✓ Aviso registrado al oficial médico' : '◆ Avisar al oficial médico'}
        </button>
        <Link className={styles.boton} href="/enlace">
          Ir a Enlace con Tierra →
        </Link>
        <Link className={`${styles.boton} ${styles.botonIa}`} href="/vega">
          Preguntar a Vega →
        </Link>
      </div>
    </Card>
  );
}

function EspecialistaCard({ especialista }) {
  return (
    <Card acento={especialista.nivel} className={styles.especialista}>
      <div className={styles.especialistaTop}>
        <h3>{especialista.nombre}</h3>
        <TrafficLight nivel={especialista.nivel} />
      </div>
      <p className={styles.opinion}>{especialista.opinion}</p>
      {especialista.citas.length > 0 && (
        <ul className={styles.citas} aria-label={`Fuentes de ${especialista.nombre}`}>
          {especialista.citas.map((c) => (
            <li key={c.id}>
              <a href={c.url} target="_blank" rel="noopener noreferrer">
                <span className={styles.idCita}>{c.id}</span> {c.titulo}
              </a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function DesacuerdosCard({ desacuerdos }) {
  return (
    <Card titulo="Desacuerdos resueltos" className={styles.desacuerdosCard}>
      {desacuerdos.length === 0 ? (
        <p className={styles.sinDesacuerdos}>
          Los 5 especialistas coincidieron en la lectura de los datos de esta semana.
        </p>
      ) : (
        <div className={styles.desacuerdosLista}>
          {desacuerdos.map((d, i) => (
            <article key={`${i}-${d.tema}`} className={styles.desacuerdo}>
              <h3>{d.tema}</h3>
              <ul className={styles.posiciones}>
                {d.posiciones.map((p, j) => (
                  <li key={`${j}-${p.especialista}`}>
                    <strong>{p.especialista}:</strong> {p.postura}
                  </li>
                ))}
              </ul>
              <p className={styles.resolucion}>
                <strong>Resolución:</strong> {d.resolucion}
              </p>
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}

function InformesCard({ pestanas, activa, onCambiar }) {
  const actual = pestanas.find((p) => p.id === activa) ?? pestanas[0];
  if (!actual) return null;

  return (
    <Card className={styles.informes}>
      <div className={styles.informesHeader}>
        <h2 className={styles.tituloSeccion}>Informes</h2>
        <div className={styles.tabs} role="tablist" aria-label="Informes de la junta médica">
          {pestanas.map((p) => {
            const seleccionado = p.id === actual.id;
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                id={`tab-${p.id}`}
                aria-selected={seleccionado}
                aria-controls={`panel-${p.id}`}
                onClick={() => onCambiar(p.id)}
              >
                {p.etiqueta}
              </button>
            );
          })}
        </div>
      </div>

      <div
        role="tabpanel"
        id={`panel-${actual.id}`}
        aria-labelledby={`tab-${actual.id}`}
        className={styles.tabpanel}
      >
        {actual.id === 'astronauta' ? (
          <div className={styles.informeAstronauta}>
            <h3>{actual.titulo}</h3>
            <p className={styles.resumen}>{actual.resumen}</p>
            <h4>Qué hacer</h4>
            <ul className={styles.lista}>
              {actual.queHacer.map((item, i) => (
                <li key={`${i}-${item.slice(0, 24)}`}>{item}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className={styles.informeTecnico}>
            <p className={styles.resumen}>{actual.resumen}</p>
            <div className={styles.tecnicoGrid}>
              <div>
                <h4>Hallazgos</h4>
                <ul className={styles.lista}>
                  {actual.hallazgos.map((h, i) => (
                    <li key={`${i}-${h.slice(0, 24)}`}>{h}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4>Plan</h4>
                <ul className={styles.lista}>
                  {actual.plan.map((p, i) => (
                    <li key={`${i}-${p.slice(0, 24)}`}>{p}</li>
                  ))}
                </ul>
              </div>
            </div>
            {actual.recordatorios.length > 0 && (
              <div className={styles.recordatoriosWrap}>
                <h4>Recordatorios por sol</h4>
                <ul className={styles.recordatorios}>
                  {actual.recordatorios.map((r, i) => (
                    <li key={`${i}-${r.sol}-${r.titulo}`} className={styles.recordatorio}>
                      <span className={styles.solChip}>Sol {r.sol}</span>
                      <div>
                        <strong>{r.titulo}</strong>
                        <p>{r.detalle}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
