'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/Card';
import TrafficLight from '@/components/TrafficLight';
import { useSesion } from '@/lib/auth/sesion';
import { actualizarRespuestaLocalEnlace } from '@/lib/datos/enlace';
import { estaSupabaseConfigurado } from '@/lib/supabase/cliente';
import {
  guardarRespuestaHoustonRemota,
  listarActividadRecienteHouston,
  listarTransmisionesEnlaceRemotas,
} from '@/lib/supabase/sincronizar';
import styles from './HoustonPantalla.module.scss';

const CONSULTAS_SUGERIDAS = [
  'Reactivación viral herpes labial inmunidad estrés sueño',
  'Deuda de sueño y desincronización circadiana',
  'SANS síndrome neuro ocular cambios visuales',
  'Ejercicio aeróbico resistencia contramedidas en Marte',
];

const ETIQUETA_ESTADO = {
  en_cola: 'En cola en Marte',
  viajando_ida: 'En tránsito hacia Houston',
  en_houston: 'Recibido en Houston · Pendiente de dictamen',
  viajando_vuelta: 'Respuesta viajando a Marte',
  recibido: 'Dictamen transmitido a Base Marte',
};

export default function HoustonPantalla() {
  const sesion = useSesion();
  const supabaseOk = estaSupabaseConfigurado();

  const [transmisiones, setTransmisiones] = useState([]);
  const [seleccionId, setSeleccionId] = useState(null);
  const [modoOrigen, setModoOrigen] = useState('cargando');
  const [actividad, setActividad] = useState({ mediciones: [], sintomas: [] });

  // Editor de dictamen médico
  const [nivelRecomendado, setNivelRecomendado] = useState('orange');
  const [asunto, setAsunto] = useState('');
  const [resumenTecnico, setResumenTecnico] = useState('');
  const [indicacionesTexto, setIndicacionesTexto] = useState('');
  const [resumenSimple, setResumenSimple] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [estadoGuardado, setEstadoGuardado] = useState('');

  // Buscador RAG vectorial pgvector
  const [consultaRag, setConsultaRag] = useState(CONSULTAS_SUGERIDAS[0]);
  const [resultadosRag, setResultadosRag] = useState([]);
  const [fuenteRag, setFuenteRag] = useState('');
  const [buscandoRag, setBuscandoRag] = useState(false);

  const cargarFormularioDesdeTransmision = useCallback((tx) => {
    if (!tx) return;
    const resp = tx.respuesta_medica ?? {};
    const vega = tx.traduccion_vega ?? {};
    setNivelRecomendado(resp.nivelRecomendado ?? tx.nivel ?? 'orange');
    setAsunto(resp.asunto ?? `Respuesta médica Sol ${tx.sol} · ${tx.astronaut_name}`);
    setResumenTecnico(resp.resumenTecnico ?? tx.resumen_tecnico ?? '');
    setIndicacionesTexto(
      Array.isArray(resp.indicaciones) ? resp.indicaciones.join('\n') : ''
    );
    setResumenSimple(vega.resumenSimple ?? '');
  }, []);

  const cargarBandeja = useCallback(async () => {
    const res = await listarTransmisionesEnlaceRemotas();
    setTransmisiones(res.datos);
    setModoOrigen(res.modo);
    const primera = res.datos.find((d) => d.id === seleccionId) ?? res.datos[0];
    if (primera) {
      setSeleccionId(primera.id);
      cargarFormularioDesdeTransmision(primera);
      const act = await listarActividadRecienteHouston(primera.astronaut_id || 'ana');
      setActividad(act);
    }
  }, [cargarFormularioDesdeTransmision, seleccionId]);

  const ejecutarBusquedaRag = useCallback(async (texto) => {
    const q = String(texto ?? consultaRag).trim();
    if (!q) return;
    setBuscandoRag(true);
    try {
      const resp = await fetch('/api/rag', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ consulta: q, limite: 4 }),
      });
      const json = await resp.json();
      if (json.ok) {
        setResultadosRag(json.resultados ?? []);
        setFuenteRag(json.fuente ?? 'pgvector');
      }
    } catch {
      /* mantiene resultados previos */
    } finally {
      setBuscandoRag(false);
    }
  }, [consultaRag]);

  useEffect(() => {
    cargarBandeja();
    ejecutarBusquedaRag(CONSULTAS_SUGERIDAS[0]);
    // Solo al montar para inicializar bandeja + primera consulta RAG
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activa = transmisiones.find((t) => t.id === seleccionId) ?? transmisiones[0];

  async function seleccionarTransmision(tx) {
    setSeleccionId(tx.id);
    setEstadoGuardado('');
    cargarFormularioDesdeTransmision(tx);
    const act = await listarActividadRecienteHouston(tx.astronaut_id || 'ana');
    setActividad(act);
  }

  async function manejarEnviarDictamen(e) {
    e.preventDefault();
    if (!activa || guardando) return;
    setGuardando(true);
    setEstadoGuardado('');

    const indicaciones = indicacionesTexto
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const nuevaRespuesta = {
      remitente: `${sesion.rol === 'houston' ? sesion.nombre : 'Dra. Elena Vance'} · Médica de vuelo (Houston)`,
      sol: activa.sol,
      nivelRecomendado,
      asunto: asunto.trim(),
      resumenTecnico: resumenTecnico.trim(),
      indicaciones,
      actualizadoEn: new Date().toISOString(),
    };

    const nuevaTraduccion = {
      titulo: 'Qué te dijo la médica desde Tierra',
      resumenSimple:
        resumenSimple.trim() ||
        'Houston revisó tus signos vitales y envió indicaciones claras para acompañarte en los próximos soles.',
      textoVoz: resumenSimple.trim() || resumenTecnico.trim(),
      pasos: indicaciones.length > 0 ? indicaciones : ['Seguir las indicaciones clínicas enviadas por Houston.'],
    };

    const res = await guardarRespuestaHoustonRemota(activa.id, nuevaRespuesta, nuevaTraduccion);
    actualizarRespuestaLocalEnlace(nuevaRespuesta, nuevaTraduccion);
    setGuardando(false);

    if (res.ok) {
      setEstadoGuardado('Dictamen guardado en Supabase PostgreSQL y transmitido a la pantalla /enlace de Base Marte.');
      await cargarBandeja();
    } else {
      setEstadoGuardado(`Guardado localmente (aviso remoto: ${res.error}).`);
    }
  }

  return (
    <div className={styles.pantalla}>
      <header className={styles.encabezado}>
        <div>
          <h1>Consola Médica · Houston (JSC)</h1>
          <p className={styles.sub}>
            Bandeja de diagnósticos recibidos desde Ares IV · Consulta semántica RAG sobre protocolos NASA en PostgreSQL + pgvector
          </p>
        </div>
        <div className={styles.badges}>
          <span className={`${styles.pill} ${supabaseOk && modoOrigen === 'supabase' ? styles.pillOk : ''}`}>
            {modoOrigen === 'supabase' ? '● PostgreSQL + pgvector activo' : '○ Modo respaldo local'}
          </span>
          <Link href="/login" className={styles.pillLink}>
            Rol: {sesion.nombre}
          </Link>
        </div>
      </header>

      <div className={styles.gridPrincipal}>
        <section className={styles.columnaIzquierda} aria-label="Bandeja de informes desde Marte">
          <Card titulo="Bandeja de entrada desde Base Marte" acento={activa?.nivel ?? 'orange'}>
            <div className={styles.bandejaHeader}>
              <span className={styles.contador}>
                {transmisiones.length} informe{transmisiones.length === 1 ? '' : 's'} en cola/archivo
              </span>
              <button type="button" className={styles.boton} onClick={cargarBandeja}>
                ↻ Actualizar bandeja
              </button>
            </div>

            <div className={styles.listaTransmisiones}>
              {transmisiones.map((tx) => {
                const esActiva = tx.id === activa?.id;
                return (
                  <button
                    key={tx.id}
                    type="button"
                    className={`${styles.txItem} ${esActiva ? styles.txActiva : ''}`}
                    onClick={() => seleccionarTransmision(tx)}
                  >
                    <div className={styles.txTop}>
                      <TrafficLight nivel={tx.nivel} />
                      <span className={styles.txTitulo}>{tx.astronaut_name} · Sol {tx.sol}</span>
                    </div>
                    <span className={styles.txEstado}>
                      {ETIQUETA_ESTADO[tx.estado] ?? tx.estado}
                    </span>
                  </button>
                );
              })}
            </div>

            {activa && (
              <div className={styles.detalleTx}>
                <h3>{activa.titulo}</h3>
                <p className={styles.resumen}>{activa.resumen_tecnico}</p>

                <div className={styles.dobleLista}>
                  <div>
                    <h4>Hallazgos de la Junta médica</h4>
                    <ul>
                      {(activa.hallazgos ?? []).map((h, i) => (
                        <li key={`${i}-${h.slice(0, 15)}`}>{h}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4>Plan propuesto por Base Marte</h4>
                    <ul>
                      {(activa.plan_sugerido ?? []).map((p, i) => (
                        <li key={`${i}-${p.slice(0, 15)}`}>{p}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {actividad.mediciones.length > 0 && (
                  <div className={styles.telemetria}>
                    <h4>Últimas mediciones sincronizadas en PostgreSQL ({activa.astronaut_name})</h4>
                    <div className={styles.chipsTelemetria}>
                      {actividad.mediciones.slice(0, 6).map((m) => (
                        <span key={m.id} className={styles.metricaChip}>
                          <strong>{m.indicator}:</strong> {m.value} {m.unit}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card titulo="Base vectorial RAG (pgvector) · Protocolos clínicos NASA" acento="ia">
            <form
              className={styles.ragForm}
              onSubmit={(e) => {
                e.preventDefault();
                ejecutarBusquedaRag(consultaRag);
              }}
            >
              <input
                type="search"
                value={consultaRag}
                onChange={(e) => setConsultaRag(e.target.value)}
                placeholder="Buscar síntomas, riesgos NASA o contramedidas..."
                aria-label="Consulta clínica para búsqueda vectorial"
              />
              <button type="submit" className={styles.botonIa} disabled={buscandoRag}>
                {buscandoRag ? 'Buscando…' : '✦ Buscar en pgvector'}
              </button>
            </form>

            <div className={styles.sugerencias}>
              {CONSULTAS_SUGERIDAS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={styles.chipSugerencia}
                  onClick={() => {
                    setConsultaRag(s);
                    ejecutarBusquedaRag(s);
                  }}
                >
                  {s.split(' ').slice(0, 4).join(' ')}…
                </button>
              ))}
            </div>

            {fuenteRag && (
              <p className={styles.ragMeta}>
                Motor: <strong>{fuenteRag === 'pgvector' ? 'Supabase pgvector (cosine <=>, 384 dims)' : 'Respaldo vectorial local'}</strong>
              </p>
            )}

            <div className={styles.ragResultados}>
              {resultadosRag.map((doc) => (
                <article key={doc.id} className={styles.ragDoc}>
                  <div className={styles.ragDocTop}>
                    <span className={styles.ragCat}>{doc.categoria}</span>
                    <span className={styles.ragSim}>
                      {Math.max(0, Math.round((doc.similitud ?? 0) * 100))}% similitud
                    </span>
                  </div>
                  <h4>{doc.titulo}</h4>
                  <p>{doc.resumen}</p>
                  {Array.isArray(doc.fuentes) && doc.fuentes.length > 0 && (
                    <div className={styles.ragFuentes}>
                      {doc.fuentes.slice(0, 2).map((f) => (
                        <a key={f.url} href={f.url} target="_blank" rel="noreferrer">
                          [{f.tipo?.toUpperCase() ?? 'NASA'}] {f.titulo} ↗
                        </a>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </Card>
        </section>

        <section className={styles.columnaDerecha} aria-label="Redacción de respuesta médica">
          <Card titulo="Responder a Base Marte (Enlace Tierra ↔ Marte)" acento={nivelRecomendado}>
            <form className={styles.editorForm} onSubmit={manejarEnviarDictamen}>
              <label className={styles.campo}>
                <span>Nivel de alerta recomendado por Houston</span>
                <select
                  value={nivelRecomendado}
                  onChange={(e) => setNivelRecomendado(e.target.value)}
                >
                  <option value="green">● Verde · Todo bien</option>
                  <option value="yellow">▲ Amarillo · Revisar</option>
                  <option value="orange">◆ Naranja · Seguimiento médico</option>
                  <option value="red">■ Rojo · Prioridad alta</option>
                </select>
              </label>

              <label className={styles.campo}>
                <span>Asunto del dictamen</span>
                <input
                  type="text"
                  value={asunto}
                  onChange={(e) => setAsunto(e.target.value)}
                  required
                />
              </label>

              <label className={styles.campo}>
                <span>Dictamen clínico técnico (visible para el CMO y la tripulante en /enlace)</span>
                <textarea
                  rows={5}
                  value={resumenTecnico}
                  onChange={(e) => setResumenTecnico(e.target.value)}
                  required
                />
              </label>

              <label className={styles.campo}>
                <span>Indicaciones paso a paso (una por línea)</span>
                <textarea
                  rows={4}
                  value={indicacionesTexto}
                  onChange={(e) => setIndicacionesTexto(e.target.value)}
                  required
                />
              </label>

              <label className={styles.campo}>
                <span>Versión serena para la tripulante (leída por Vega)</span>
                <textarea
                  rows={3}
                  value={resumenSimple}
                  onChange={(e) => setResumenSimple(e.target.value)}
                />
              </label>

              <div className={styles.editorAcciones}>
                <button type="submit" className={styles.botonAcento} disabled={guardando || !activa}>
                  {guardando ? 'Guardando en Supabase…' : '🛰 Guardar y transmitir a Base Marte'}
                </button>
                <Link href="/enlace" className={styles.boton}>
                  Ver vista en Marte (/enlace) →
                </Link>
              </div>

              {estadoGuardado && (
                <p className={styles.feedbackOk} role="status">{estadoGuardado}</p>
              )}
            </form>
          </Card>
        </section>
      </div>
    </div>
  );
}
