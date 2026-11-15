'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import CabeceraMision from '@/components/layout/CabeceraMision';
import { useEstadoMision } from '@/lib/datos/demo';
import { useCanalInformes } from '@/lib/datos/canalInformes';
import { alternarAutoAvance, avanzarTransmision, reiniciarEnlace, useEnlace } from '@/lib/datos/enlace';
import { guardarEnvioCanal, sincronizarCanal } from '@/lib/enlace/canal';
import { calcularEstadoEnvio, DURACION_EVALUACION_MIN, RETRASO_SOLO_IDA_MIN, RESPUESTA_MEDICA_SOL42 } from '@/lib/enlace/logicaEnlace';
import { agruparMensajesPorDia, crearTransmisionCanal, informeDesdeRegistros, mensajesDeTransmisiones } from '@/lib/enlace/informes';
import styles from './EnlacePantalla.module.scss';

const FECHA = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const HORA = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });

function Icono({ tipo }) {
  if (tipo === 'informe') return <img src="/figma/nav-informes.svg" width="20" height="20" alt="" />;
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {tipo === 'enviar'
        ? <><path d="m21 3-7 18-4-7-7-4 18-7Z" /><path d="m10 14 11-11" /></>
        : <><path d="M3 8a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0M9 16a5 5 0 0 1 6 0" /><circle cx="12" cy="20" r=".8" fill="currentColor" stroke="none" /></>}
    </svg>
  );
}

export default function EnlacePantalla() {
  const { activoId, astronauta, solActual, mision, lecturas, evaluacion, cargando: cargandoEstado } = useEstadoMision();
  const cargando = cargandoEstado || !astronauta;
  const { junta, transmisiones, conectado } = useCanalInformes(activoId, solActual);
  const enlace = useEnlace();
  const [simulacion, setSimulacion] = useState(null);
  const [borrador, setBorrador] = useState({ astronautId: null, texto: '' });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const bloqueoEnvio = useRef(false);
  const conversacionRef = useRef(null);
  const texto = borrador.astronautId === activoId ? borrador.texto : '';
  const informe = useMemo(() => informeDesdeRegistros({ astronauta, lecturas, evaluacion, sol: solActual, junta }), [astronauta, lecturas, evaluacion, solActual, junta]);
  const simulacionActual = simulacion?.astronautId === activoId ? simulacion : null;
  const envioSimulado = calcularEstadoEnvio(simulacionActual && enlace.iniciado ? enlace.minutosTranscurridos : null);
  const mensajes = useMemo(() => {
    const historial = mensajesDeTransmisiones(transmisiones, activoId);
    if (simulacionActual) {
      historial.push({
        id: `${simulacionActual.id}-salida`,
        direccion: 'salida',
        remitente: simulacionActual.remitente,
        texto: `Envío de informe correspondiente al Sol ${simulacionActual.sol}.`,
        ts: simulacionActual.iniciadaEn,
        sol: simulacionActual.sol,
        enviado: enlace.iniciado,
        recibidoEnDestino: envioSimulado.hitos[1].completado,
        simulada: true,
      });
    }
    if (simulacionActual?.recibidaEn) {
      historial.push({
        id: simulacionActual.id,
        direccion: 'entrada',
        remitente: simulacionActual.respuesta.remitente || 'Base de Control Terrestre',
        texto: simulacionActual.respuesta.resumenTecnico,
        indicaciones: simulacionActual.respuesta.indicaciones || [],
        ts: simulacionActual.recibidaEn,
        sol: simulacionActual.respuesta.sol ?? simulacionActual.sol,
        entrega: 'recibido',
        enviado: true,
        recibidoEnDestino: true,
        simulada: true,
      });
    }
    return historial.sort((a, b) => String(a.ts || '').localeCompare(String(b.ts || '')));
  }, [transmisiones, activoId, simulacionActual, enlace.iniciado, envioSimulado.hitos[1].completado]);
  const grupos = agruparMensajesPorDia(mensajes);
  const ultimoMensaje = mensajes.at(-1);
  const ultimaActualizacion = ultimoMensaje ? `${ultimoMensaje.id}-${ultimoMensaje.ts}` : '';

  useEffect(() => {
    if (!envioSimulado.respuestaDisponible || !simulacionActual || simulacionActual.recibidaEn) return;
    setSimulacion((actual) => actual?.id === simulacionActual.id
      ? { ...actual, recibidaEn: new Date().toISOString() }
      : actual);
  }, [envioSimulado.respuestaDisponible, simulacionActual]);

  useEffect(() => {
    const contenedor = conversacionRef.current;
    if (contenedor) contenedor.scrollTop = contenedor.scrollHeight;
  }, [ultimaActualizacion]);

  async function enviar(esInforme) {
    if (bloqueoEnvio.current || cargando) return;
    bloqueoEnvio.current = true;
    setEnviando(true);
    setError(null);
    try {
      const transmision = crearTransmisionCanal({ texto, informe: esInforme ? informe : null, astronauta, sol: solActual });
      await guardarEnvioCanal(transmision);
      if (!esInforme) setBorrador({ astronautId: activoId, texto: '' });
      sincronizarCanal(activoId).catch(() => {});
    } catch {
      setError({ astronautId: activoId, texto: 'No se pudo guardar el envío. Intentá de nuevo.' });
    } finally {
      bloqueoEnvio.current = false;
      setEnviando(false);
    }
  }

  function enviarMensaje(evento) {
    evento.preventDefault();
    if (texto.trim()) enviar(false);
  }

  function prepararSimulacion() {
    if (simulacionActual || cargando) return;
    const ultimaRespuesta = [...transmisiones]
      .filter((transmision) => transmision.respuesta_medica?.resumenTecnico)
      .sort((a, b) => String(b.actualizado_en || '').localeCompare(String(a.actualizado_en || '')))[0];
    reiniciarEnlace();
    setSimulacion({
      id: `simulacion-${crypto.randomUUID()}`,
      astronautId: activoId,
      remitente: astronauta.name,
      sol: informe.sol,
      iniciadaEn: new Date().toISOString(),
      respuesta: ultimaRespuesta?.respuesta_medica || RESPUESTA_MEDICA_SOL42,
      recibidaEn: null,
    });
  }

  function avanzarSimulacion(minutos) {
    prepararSimulacion();
    avanzarTransmision(minutos);
  }

  function alternarSimulacion() {
    prepararSimulacion();
    alternarAutoAvance();
  }

  function reiniciarSimulacion() {
    reiniciarEnlace();
    setSimulacion(null);
  }

  return (
    <div className={styles.pantalla} data-dashboard>
      <CabeceraMision nombre={astronauta?.name} titulo={astronauta?.titulo} sol={solActual} entorno={mision?.entorno} mostrarNotificaciones={false} />
      <h1 className={styles.oculto}>Informes</h1>
      <section className={styles.simulacion} aria-labelledby="titulo-simulacion">
        <div className={styles.cabeceraSimulacion}>
          <div>
            <h2 id="titulo-simulacion">Simular respuesta</h2>
            <p>{RETRASO_SOLO_IDA_MIN} min de ida · {DURACION_EVALUACION_MIN} min de evaluación · {RETRASO_SOLO_IDA_MIN} min de vuelta</p>
          </div>
          <span className={styles.tiempoSimulacion}>{envioSimulado.minutosTranscurridos} / {envioSimulado.duracionTotalMin} min</span>
        </div>
        <div className={styles.controlesSimulacion}>
          <button type="button" className={styles.enviar} onClick={() => avanzarSimulacion(0)} disabled={cargando || Boolean(simulacionActual)}>Iniciar simulación</button>
          <button type="button" onClick={() => avanzarSimulacion(5)} disabled={cargando || envioSimulado.respuestaDisponible}>Adelantar +5 min</button>
          <button type="button" onClick={() => avanzarSimulacion(envioSimulado.duracionTotalMin)} disabled={cargando || envioSimulado.respuestaDisponible}>Completar recorrido</button>
          <button type="button" onClick={alternarSimulacion} aria-pressed={Boolean(simulacionActual && enlace.autoAvance)} disabled={cargando || envioSimulado.respuestaDisponible}>
            {simulacionActual && enlace.autoAvance ? 'Pausar auto-avance' : 'Auto-avance'}
          </button>
          <button type="button" onClick={reiniciarSimulacion} disabled={!simulacionActual}>Reiniciar</button>
        </div>
        <div className={styles.progresoSimulacion} role="progressbar" aria-label="Recorrido de la respuesta simulada" aria-valuenow={envioSimulado.progresoPct} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${envioSimulado.progresoPct}%` }} />
        </div>
        <div className={styles.estadoSimulacion}>
          <p role="status">{envioSimulado.etiqueta}</p>
          <span>{envioSimulado.respuestaDisponible ? 'Respuesta simulada disponible en el chat' : `Restan ${envioSimulado.minutosRestantes} min`}</span>
        </div>
        <ol className={styles.hitosSimulacion}>
          {envioSimulado.hitos.map((hito) => <li key={hito.id} data-estado={hito.estado} aria-current={hito.activo ? 'step' : undefined}>
            <span aria-hidden="true">{hito.completado ? '✓' : '○'}</span>
            <div><small>Min {hito.minutoObjetivo}</small><span>{hito.etiqueta}</span></div>
          </li>)}
        </ol>
      </section>
      <section className={styles.canal} aria-labelledby="titulo-canal">
        <header className={styles.cabeceraCanal}>
          <span className={styles.iconoConexion}><Icono tipo="conexion" /></span>
          <div>
            <h2 id="titulo-canal">Base de Control Terrestre</h2>
            <p>Canal de comunicación con Tierra</p>
          </div>
          <span className={styles.estadoEnlace} data-conectado={conectado}><i aria-hidden="true" />{conectado ? 'Enlace activo' : 'Sin conexión con Tierra'}</span>
        </header>
        <div className={styles.conversacion} ref={conversacionRef} role="log" aria-label="Mensajes con Control Terrestre" aria-relevant="additions text">
          {grupos.length ? grupos.map((grupo) => (
            <div key={grupo.clave}>
              <div className={styles.fechaConversacion}><span>{grupo.ts ? `${FECHA.format(new Date(grupo.ts))} · UTC` : `Sol ${grupo.sol}`}</span></div>
              <div className={styles.columnasMensajes}>
                <div className={styles.entrantes}>{grupo.entrada.map((mensaje) => <Mensaje key={mensaje.id} mensaje={mensaje} />)}</div>
                <div className={styles.salientes}>{grupo.salida.map((mensaje) => <Mensaje key={mensaje.id} mensaje={mensaje} />)}</div>
              </div>
            </div>
          )) : <p className={styles.sinMensajes}>{cargando ? 'Cargando mensajes…' : 'Todavía no hay mensajes guardados con Control Terrestre.'}</p>}
        </div>
        <form className={styles.compositor} onSubmit={enviarMensaje}>
          <label className={styles.oculto} htmlFor="mensaje-control-terrestre">Mensaje para Control Terrestre</label>
          <input
            id="mensaje-control-terrestre"
            value={texto}
            onChange={(evento) => setBorrador({ astronautId: activoId, texto: evento.target.value })}
            placeholder="Escribí un mensaje para Control Terrestre…"
            autoComplete="off"
            disabled={cargando || enviando}
          />
          <button className={styles.enviar} type="submit" disabled={cargando || enviando || !texto.trim()}><Icono tipo="enviar" />{enviando ? 'Enviando…' : 'Enviar'}</button>
          <button className={styles.enviarInforme} type="button" onClick={() => enviar(true)} disabled={cargando || enviando || informe.disponible === false}><Icono tipo="informe" />Enviar informe</button>
          {error?.astronautId === activoId && <p className={styles.error} role="alert">{error.texto}</p>}
        </form>
      </section>
      <section className={styles.informe} aria-labelledby="titulo-informe" aria-busy={cargando}>
        <h2 id="titulo-informe"><span className={styles.iconoInforme}><Icono tipo="informe" /></span>Informe</h2>
        <p className={styles.resumenClinico}>{cargando ? 'Cargando los registros del tripulante…' : informe.resumen}</p>
        <div className={styles.detalleInforme}>
          <div>
            <h3>Hallazgos principales</h3>
            <ListaClinica elementos={informe.hallazgos} vacio="Sin hallazgos registrados." />
          </div>
          <div>
            <h3>Plan propuesto a Houston</h3>
            <ListaClinica elementos={informe.plan} vacio="Sin indicaciones registradas." />
          </div>
        </div>
      </section>
    </div>
  );
}

function Mensaje({ mensaje }) {
  const fecha = Date.parse(mensaje.ts);
  const destino = mensaje.direccion === 'salida' ? 'Tierra' : 'Base Marte';
  const estadoEnvio = mensaje.enviado ? 'Enviado' : 'Pendiente de envío';
  const estadoRecepcion = mensaje.recibidoEnDestino ? `Recibido en ${destino}` : `Pendiente de recepción en ${destino}`;
  const descripcionEntrega = `${estadoEnvio}. ${estadoRecepcion}.`;
  return (
    <article className={styles.mensaje} data-direccion={mensaje.direccion}>
      <div className={styles.burbuja}>
        <header>
          <strong>{mensaje.remitente}</strong>
          {mensaje.simulada && <span className={styles.etiquetaSimulada}>Simulada</span>}
          {Number.isFinite(fecha) && <time dateTime={mensaje.ts} title={`${FECHA.format(new Date(fecha))} · UTC`}>{HORA.format(new Date(fecha))}</time>}
        </header>
        <p>{mensaje.texto}</p>
        {mensaje.indicaciones?.length > 0 && <div className={styles.indicaciones}>
          <h3>Indicaciones clínicas</h3>
          <ListaClinica elementos={mensaje.indicaciones} />
        </div>}
      </div>
      <span className={styles.entrega} role="img" aria-label={descripcionEntrega} title={descripcionEntrega}>
        <i data-activo={mensaje.enviado} title={estadoEnvio} aria-hidden="true" />
        <i data-activo={mensaje.recibidoEnDestino} title={estadoRecepcion} aria-hidden="true" />
      </span>
    </article>
  );
}

function ListaClinica({ elementos, vacio }) {
  if (!elementos.length) return vacio ? <p className={styles.sinDatos}>{vacio}</p> : null;
  return <ul>{elementos.map((texto, indice) => <li key={`${indice}-${texto}`}>{texto}</li>)}</ul>;
}
