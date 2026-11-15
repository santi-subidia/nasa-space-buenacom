'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import CabeceraMision from '@/components/layout/CabeceraMision';
import OrigenUmbral from '@/components/OrigenUmbral';
import VytaVoz from '@/components/inicio/VytaVoz';
import { useEstadoMision } from '@/lib/datos/demo';
import { rutaZona } from '@/lib/content/rutaZona';
import { datosSalud, ETIQUETAS_NIVEL } from './datos';
import MapaZonas from './MapaZonas';
import styles from './SaludPantalla.module.scss';

const TITULOS = { fisica: 'Física', mental: 'Mental', riesgos: 'Riesgos' };
const PROTOCOLOS = {
  fisica: [
    ['dumbbell', 'Ejercicio de resistencia', 'Continuá tu entrenamiento con seguimiento de repeticiones y técnica.', '/entrenador'],
    ['drop', 'Control de hidratación', 'Registrá tu ingesta de agua y consultá su evolución.', '/registrar'],
    ['brain', 'Check-in de salud conductual', 'Completá el registro de ánimo, estrés y descanso.', '/registrar'],
  ],
  mental: [
    ['bed', 'Higiene del sueño', 'Consultá tus registros de descanso y la guía de sueño.', rutaZona('brain')],
    ['people', 'Conexión y comunicación', 'Accedé al enlace con Tierra y a tus informes de seguimiento.', '/enlace'],
    ['lotus', 'Manejo del estrés', 'Registrá cómo te sentís y revisá tu evolución.', '/registrar'],
  ],
  riesgos: [
    ['dumbbell', 'Ejercicio de resistencia', 'Abrí el entrenador y continuá las actividades de tu plan.', '/entrenador'],
    ['drop', 'Control de hidratación', 'Registrá tu ingesta de agua y completá el chequeo diario.', '/registrar'],
    ['brain', 'Bienestar y aislamiento', 'Revisá los indicadores de bienestar y tu seguimiento mental.', '/salud/mental'],
  ],
};

function Icono({ nombre, className = '' }) {
  return <img src={`/figma/salud/${nombre}.svg`} width="28" height="28" alt="" className={className} />;
}

function Etiqueta({ nivel, texto }) {
  return <span className={styles.etiqueta} data-nivel={nivel || 'sin-datos'}><i aria-hidden="true" />{texto || ETIQUETAS_NIVEL[nivel] || 'Sin datos'}</span>;
}

function resumenEstado(seccion, estado) {
  if (!estado.nivel) return 'Todavía no hay registros suficientes para evaluar este apartado.';
  if (estado.alertas.length) return estado.alertas[0].why;
  if (seccion === 'mental') return 'Los indicadores de bienestar registrados están dentro de los rangos del seguimiento actual.';
  if (seccion === 'fisica') return 'Los indicadores físicos registrados están dentro de los rangos del seguimiento actual.';
  return 'Sin alertas activas en los registros actuales. Continuá con el seguimiento de la misión.';
}

export default function SaludPantalla({ seccion, zona = null }) {
  const { astronauta, solActual, mision, cabina, lecturas, sintomas, evaluacion, cargando } = useEstadoMision();
  const datos = useMemo(
    () => datosSalud({ lecturas, sintomas, evaluacion, baseline: astronauta?.baseline || {}, sol: solActual, entorno: evaluacion.env, cabina }),
    [lecturas, sintomas, evaluacion, astronauta, solActual, cabina],
  );
  const estado = datos[seccion];
  const resumen = resumenEstado(seccion, estado);
  return (
    <div className={styles.pantalla} data-dashboard data-salud={seccion} aria-busy={cargando}>
      <CabeceraMision nombre={astronauta?.name} titulo={astronauta?.titulo} sol={solActual} entorno={mision?.entorno} />
      <h1 className={styles.oculto}>Salud / {TITULOS[seccion]}</h1>
      <div className={styles.paneles}>
        <div className={styles.principal}>
          <EstadoGeneral seccion={seccion} estado={estado} resumen={resumen} cargando={cargando} />
          {seccion === 'fisica' && <>
            <section className={`${styles.panel} ${styles.vitales}`} aria-labelledby="titulo-vitales">
              <h2 className={styles.tituloSeccion} id="titulo-vitales">Signos vitales</h2>
              <div className={styles.grillaVitales}>{datos.vitales.map((dato) => <Vital key={dato.id} dato={dato} />)}</div>
            </section>
            <section className={`${styles.panel} ${styles.indicadoresFisicos}`} aria-labelledby="titulo-fisicos">
              <h2 className={styles.tituloSeccion} id="titulo-fisicos">Indicadores físicos clave</h2>
              <div className={styles.grillaFisicos}>
                {estado.indicadores.map((dato) => <Indicador key={dato.id} dato={dato} />)}
                <VytaVoz seccion={seccion} resumen={resumen} className={styles.vozFisica} />
              </div>
            </section>
          </>}
          {seccion === 'mental' && <>
            <section className={`${styles.panel} ${styles.indicadoresMentales}`} aria-labelledby="titulo-mental">
              <h2 className={styles.tituloSeccion} id="titulo-mental">Indicadores de bienestar</h2>
              <div className={styles.grillaMental}>{estado.indicadores.map((dato) => <Indicador key={dato.id} dato={dato} />)}</div>
            </section>
            <div className={`${styles.inferior} ${styles.inferiorMental}`}>
              <Tendencia datos={datos.historia} tipo="mental" />
              <VytaVoz seccion={seccion} resumen={resumen} />
            </div>
          </>}
          {seccion === 'riesgos' && <>
            <section className={`${styles.panel} ${styles.riesgos}`} aria-labelledby="titulo-riesgos">
              <h2 className={styles.tituloSeccion} id="titulo-riesgos">Riesgos priorizados</h2>
              <ul className={styles.listaRiesgos}>{estado.filas.map((fila) => <li key={fila.nombre}>
                <Link href={fila.href} title={fila.detalle}>
                  <Icono nombre={fila.icono} /><strong>{fila.nombre}</strong><span className={styles.descripcionRiesgo}>{fila.detalle}</span>
                  <Etiqueta nivel={fila.nivel} texto={fila.estado} /><Icono nombre="chevron" className={styles.flecha} />
                </Link>
              </li>)}</ul>
            </section>
            <div className={`${styles.inferior} ${styles.inferiorRiesgos}`}>
              <Tendencia datos={datos.historia} tipo="riesgos" />
              <VytaVoz seccion={seccion} resumen={resumen} />
            </div>
          </>}
        </div>
        <aside className={styles.lateral} aria-label="Seguimiento y protocolos">
          <Alertas key={seccion} alertas={estado.alertas} seccion={seccion} cargando={cargando} solActual={solActual} />
          <Protocolos seccion={seccion} alertas={estado.alertas} />
        </aside>
      </div>
      {/* Mapa corporal repartido por subcategoría: Física (cuerpo), Mental (cerebro) y Riesgos (peligros). */}
      <MapaZonas
        seccion={seccion}
        zona={zona}
        lecturas={lecturas}
        sintomas={sintomas}
        evaluacion={evaluacion}
        solActual={solActual}
        baseline={astronauta?.baseline || {}}
        cabinaDb={cabina}
      />
    </div>
  );
}

function EstadoGeneral({ seccion, estado, resumen, cargando }) {
  const riesgo = seccion === 'riesgos';
  const hayCriticas = estado.alertas.some((a) => a.level === 'red');
  return <section className={`${styles.panel} ${styles.estado}`} aria-labelledby="titulo-estado">
    <h2 className={styles.tituloSeccion} id="titulo-estado">{riesgo ? 'Riesgo general de misión' : `Estado ${seccion === 'fisica' ? 'físico' : 'mental'} general`}</h2>
    <div className={styles.estadoCuerpo}>
      {riesgo && <div className={styles.medidor} data-nivel={estado.nivel || 'sin-datos'}>
        <svg viewBox="0 0 190 190" width="190" height="190" fill="none" aria-hidden="true"><circle cx="95" cy="95" r="81" stroke="#1f4154" strokeWidth="13" /><circle cx="95" cy="95" r="81" stroke="currentColor" strokeWidth="6" /></svg>
        <div><strong>{estado.nivel ? estado.alertas.length : '—'}</strong><small>alertas activas</small><Etiqueta nivel={estado.nivel} /></div>
      </div>}
      <div className={styles.resumenEstado}>
        <Icono nombre="pulse" className={styles.pulso} />
        {!riesgo && <h3>{cargando ? 'Cargando…' : ETIQUETAS_NIVEL[estado.nivel] || 'Sin datos'}</h3>}
        <p>{cargando ? 'Cargando los registros del tripulante…' : resumen}</p>
        {!riesgo && <Etiqueta nivel={hayCriticas ? 'red' : estado.nivel ? 'green' : null} texto={estado.nivel ? hayCriticas ? 'Con alertas críticas' : 'Sin alertas críticas' : 'Sin datos'} />}
      </div>
      <ul className={styles.estados}>{estado.estados.map((fila) => <li key={fila.nombre}>
        <Icono nombre={fila.icono} /><span>{fila.nombre}</span><Etiqueta nivel={fila.nivel} texto={fila.estado} />
      </li>)}</ul>
    </div>
  </section>;
}

function Vital({ dato }) {
  return <article className={styles.vital} title={dato.detalle}>
    <span className={styles.iconoRedondo}><Icono nombre={dato.icono} /></span>
    <div><h3>{dato.nombre}</h3><p className={styles.valor}>{dato.valor} <small>{dato.valor !== '—' && dato.unidad}</small></p>
      <span className={styles.estadoVital} data-nivel={dato.nivel || 'sin-datos'}><i aria-hidden="true" />{dato.estado}</span>
    </div>
  </article>;
}

function Indicador({ dato }) {
  return <article className={styles.indicador} title={dato.detalle}>
    <span className={styles.iconoRedondo}><Icono nombre={dato.icono} /></span>
    <div className={styles.datoIndicador}><h3>{dato.nombre}</h3><p className={styles.valor}>{dato.valor} <small>{dato.valor !== '—' && dato.unidad}</small></p></div>
    {dato.progreso != null ? <div className={styles.barra} role="meter" aria-label="Estrés registrado" aria-valuemin={0} aria-valuemax={10} aria-valuenow={dato.valorNumerico}><span style={{ width: `${Math.max(0, Math.min(1, dato.progreso)) * 100}%` }} /></div>
      : <span className={styles.notaIndicador}>{dato.valor === '—' ? 'Sin datos' : dato.nota || dato.estado}</span>}
  </article>;
}

function Tendencia({ datos, tipo }) {
  const mental = tipo === 'mental';
  const clave = mental ? 'animo' : 'alertas';
  const hayDatos = datos.some((d) => d[clave] != null);
  return <section className={`${styles.panel} ${styles.tendencia}`} aria-labelledby={`titulo-tendencia-${tipo}`}>
    <h2 className={styles.tituloSeccion} id={`titulo-tendencia-${tipo}`}>{mental ? 'Tendencia de bienestar emocional' : 'Evolución del riesgo'}</h2>
    <p>Últimos 7 soles · {mental ? 'Ánimo registrado (1–5)' : 'Alertas activas del motor'}</p>
    {hayDatos ? <div className={styles.grafico}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={datos} margin={{ top: 5, right: 14, left: -22, bottom: 0 }} accessibilityLayer>
          <defs><linearGradient id={`salud-${tipo}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#06cdeb" stopOpacity={0.29} /><stop offset="100%" stopColor="#06cdeb" stopOpacity={0.015} /></linearGradient></defs>
          <CartesianGrid stroke="#294357" strokeDasharray="2 3" />
          <XAxis dataKey="sol" tickFormatter={(sol) => `Sol ${sol}`} tick={{ fill: '#b9cbe2', fontSize: 11 }} axisLine={{ stroke: '#678198' }} tickLine={false} minTickGap={12} />
          <YAxis domain={mental ? [1, 5] : [0, 'auto']} allowDecimals={false} tick={{ fill: '#b9cbe2', fontSize: 11 }} axisLine={{ stroke: '#678198' }} tickLine={false} width={52} />
          <Tooltip labelFormatter={(sol) => `Sol ${sol}`} formatter={(valor) => [mental ? `${valor} / 5` : `${valor} alertas`, mental ? 'Ánimo' : 'Seguimiento']} contentStyle={{ background: '#0b2031', border: '1px solid #2b5970', borderRadius: 9, fontSize: 12, color: '#f3f6ff' }} />
          <Area type="monotone" dataKey={clave} stroke="#00dff1" strokeWidth={2.1} fill={`url(#salud-${tipo})`} dot={{ r: 3.6, fill: '#26e8f8' }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div> : <p className={styles.sinDatos}>Sin registros en los últimos 7 soles.</p>}
  </section>;
}

function Alertas({ alertas, seccion, cargando, solActual }) {
  const [verTodas, setVerTodas] = useState(false);
  const limite = seccion === 'mental' ? 3 : 4;
  const visibles = verTodas ? alertas : alertas.slice(0, limite);
  return <section className={`${styles.panel} ${styles.alertas}`} aria-labelledby="titulo-alertas">
    <div className={styles.tituloPanel}><span className={styles.iconoRedondo}><Icono nombre="alert" /></span><h2 id="titulo-alertas">Alertas clínicas y observaciones</h2>
      {alertas.length > limite && <button type="button" onClick={() => setVerTodas(!verTodas)} aria-expanded={verTodas}>{verTodas ? 'Ver menos' : 'Ver todas'} <span aria-hidden="true">→</span></button>}
    </div>
    {!visibles.length ? <p className={styles.sinDatos}>{cargando ? 'Cargando registros…' : 'Sin alertas activas para este apartado.'}</p> : <ul className={styles.listaAlertas}>
      {visibles.map((alerta, i) => <li key={alerta.ruleId || i} data-nivel={alerta.level}>
        <details><summary><i className={styles.punto} aria-hidden="true" /><span><strong>{alerta.title}</strong><span>{alerta.why}</span></span><small>Sol {alerta.sol ?? solActual}</small></summary>
          <div className={styles.detalleAlerta}><p>{alerta.why}</p><ul>{(alerta.actions || []).map((accion) => <li key={accion}>{accion}</li>)}</ul>
            {alerta.nasaSource && <p className={styles.fuente}>Fuente: {alerta.nasaSource}</p>}
            <OrigenUmbral basis={alerta.basis} className={styles.fuente} />
            <div className={styles.accionesAlerta}>
              <Link href={rutaZona(alerta.zone)}>Ver guía →</Link><Link href="/enlace">Avisar al oficial médico →</Link>
            </div>
          </div>
        </details>
      </li>)}
    </ul>}
  </section>;
}

function Protocolos({ seccion, alertas }) {
  return <section className={`${styles.panel} ${styles.protocolos}`} aria-labelledby="titulo-protocolos">
    <div className={styles.tituloPanel}><span className={styles.iconoRedondo}><Icono nombre="target" /></span><h2 id="titulo-protocolos">Protocolos recomendados</h2></div>
    <ul>{PROTOCOLOS[seccion].map(([icono, nombre, descripcion, href]) => {
      const regla = alertas.find((a) => icono === 'drop' ? a.ruleId === 'threshold:water_ml' : icono === 'dumbbell' ? /exercise/.test(a.ruleId) : icono === 'bed' ? /sleep/.test(a.ruleId) : false);
      return <li key={nombre}><Link href={href}><span className={styles.iconoRedondo}><Icono nombre={icono} /></span><span><strong>{nombre}</strong><small>{regla?.actions?.[0] || descripcion}</small></span><Icono nombre="chevron" className={styles.flecha} /></Link></li>;
    })}</ul>
  </section>;
}
