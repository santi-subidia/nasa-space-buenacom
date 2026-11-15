'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Card from '@/components/Card';
import TrafficLight from '@/components/TrafficLight';
import TendenciaResumen from './TendenciaResumen';
import VytaVoz from './VytaVoz';
import CabeceraMision from '@/components/layout/CabeceraMision';
import OrigenUmbral from '@/components/OrigenUmbral';
import { SOL_ACTUAL, useEstadoMision } from '@/lib/datos/demo';
import { useCheckinDiario } from '@/lib/datos/checkin';
import { MISION } from '@/lib/mock/mision';
import { NIVELES } from '@/lib/niveles';
import { rutaZona } from '@/lib/content/rutaZona';
import { calcularPuntajeSalud, lecturasParaInicio, metricasDesdeLecturas } from './metricas';
import styles from './InicioPantalla.module.scss';

export default function InicioPantalla() {
  const { astronauta, lecturas, evaluacion } = useEstadoMision(null, SOL_ACTUAL);
  const checkin = useCheckinDiario();
  const nivelGeneral = evaluacion.globalLevel || 'green';
  const puntajeSalud = calcularPuntajeSalud(evaluacion);
  const tarjetas = metricasDesdeLecturas(lecturas, evaluacion, astronauta?.baseline || {}, SOL_ACTUAL);
  const ultimaLectura = lecturasParaInicio(lecturas, SOL_ACTUAL).at(-1);

  return (
    <div className={styles.pantalla} data-dashboard>
      <CabeceraMision nombre={astronauta?.name || MISION.astronauta.nombre} titulo={astronauta?.titulo || 'Tripulante de misión'} />
      <h1 className={styles.oculto}>Vista general · {astronauta?.name || MISION.astronauta.nombre}</h1>
      <div className={styles.paneles}>
        <div className={styles.columnaPrincipal}>
          <EstadoGeneral nivel={nivelGeneral} puntaje={puntajeSalud} alertas={evaluacion.alerts || []} checkin={checkin} ultimaLectura={ultimaLectura} />
          <section aria-label="Métricas de salud" className={styles.indicadores}>
            {tarjetas.map((tarjeta) => <TarjetaIndicador key={tarjeta.id} tarjeta={tarjeta} />)}
          </section>
          <TendenciaResumen lecturas={lecturas} />
        </div>
        <div className={styles.columnaLateral}>
          <VytaVoz />
          <AlertasObservaciones alertas={evaluacion.alerts || []} />
        </div>
      </div>
    </div>
  );
}


function EstadoGeneral({ nivel, puntaje, alertas, checkin, ultimaLectura }) {
  const principal = alertas[0] || null;
  const tienePuntaje = puntaje.valor !== null;
  const tieneEvaluacion = tienePuntaje || Boolean(principal);
  return (
    <Card className={styles.estado}>
      <div className={styles.ventanaHero} aria-hidden="true" />
      <div className={styles.estadoCabecera}>
        <h2>Estado de salud general</h2>
        <span className={styles.actualizacion}><i aria-hidden="true" /><span>Última lectura<small>{ultimaLectura ? `Sol ${ultimaLectura.sol}` : 'Sin datos'}</small></span></span>
      </div>
      <div className={styles.estadoCuerpo}>
        <div
          className={styles.anillo}
          role={tienePuntaje ? 'meter' : 'img'}
          aria-label={tienePuntaje ? 'Puntaje total de salud' : 'Puntaje de salud sin datos'}
          aria-valuemin={tienePuntaje ? 0 : undefined}
          aria-valuemax={tienePuntaje ? 100 : undefined}
          aria-valuenow={tienePuntaje ? puntaje.valor : undefined}
          title={puntaje.detalle}
        >
          <svg viewBox="0 0 200 200" width="200" height="200" fill="none" aria-hidden="true">
            <defs><linearGradient id="anillo-vyta" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#66ffe3" /><stop offset="1" stopColor="#0bd8ff" /></linearGradient></defs>
            <circle cx="100" cy="100" r="90.68" stroke="#1a2c40" strokeWidth="15.77" />
            <circle className={styles.arco} cx="100" cy="100" r="90.68" pathLength="100" stroke="url(#anillo-vyta)" strokeWidth="15.77" strokeLinecap={puntaje.valor ? 'round' : 'butt'} strokeDasharray="100" strokeDashoffset={100 - (puntaje.valor ?? 0)} transform="rotate(-90 100 100)" />
          </svg>
          <div aria-hidden="true"><strong>{puntaje.valor ?? '—'}</strong><small>/ 100</small></div>
        </div>
        <div className={styles.resumenEstado}>
          <svg className={styles.ecg} viewBox="0 0 54 30" width="54" height="30" fill="none" aria-hidden="true"><path d="M1 17h10l4-7 4 13 5-22 5 27 4-17 5 6h15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <div className={styles.estadoNivel}>
            <h3>{tieneEvaluacion ? nivel === 'green' ? 'Estable' : NIVELES[nivel]?.etiqueta : 'Sin datos'}</h3>
            {tieneEvaluacion && <span className={styles.estadoPildora}><TrafficLight nivel={nivel} /></span>}
          </div>
          <p>{principal ? principal.why : tienePuntaje ? 'Tus signos vitales se mantienen dentro de los rangos esperados. Buen estado general para continuar con las actividades de la misión.' : 'Registrá tus mediciones para calcular el puntaje de salud.'}</p>
        </div>
        <Link href="/registrar" className={`${styles.checkin} ${checkin.completado ? styles.checkinCompletado : ''}`} aria-label={`Check-in diario ${checkin.completado ? 'completado hoy' : 'pendiente'}. Ver chequeo diario`}>
          <span>Check-in diario</span>
          <span className={styles.relojArena}>
            {checkin.completado
              ? <svg viewBox="0 0 36 36" width="36" height="36" fill="none" aria-hidden="true"><path d="m8 18 7 7L29 11" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              : <Image src="/figma/reloj-arena.png" width={36} height={36} alt="" />}
          </span>
          <small role="status"><i aria-hidden="true" /> {checkin.cargando ? 'Cargando…' : checkin.completado ? 'Completado' : 'Pendiente'}</small>
        </Link>
      </div>
    </Card>
  );
}

function TarjetaIndicador({ tarjeta }) {
  const { nombre, valor, unidad, estado, color, icono, onda, detalle } = tarjeta;
  return (
    <Card className={styles.indicador} title={detalle}>
      <img className={styles.iconoMetrica} src={`/figma/${icono}.svg`} width="64" height="64" alt="" />
      <div className={styles.datoMetrica}>
        <h2>{nombre}</h2>
        <p className={styles.valor}>{valor} <small>{unidad}</small></p>
        <p className={`${styles.nivelMetrica} ${styles[color]}`}><i aria-hidden="true" />{estado}</p>
      </div>
      {onda && <img className={styles.onda} src={`/figma/onda-${onda}.svg`} width="104" height="60" alt="" />}
    </Card>
  );
}

function AlertasObservaciones({ alertas }) {
  const [verTodas, setVerTodas] = useState(false);
  const visibles = verTodas ? alertas : alertas.slice(0, 3);
  return (
    <Card className={styles.observaciones}>
      <div className={styles.observacionesTitulo}>
        <h2><svg viewBox="0 0 24 28" width="22" height="26" fill="none" aria-hidden="true"><path d="M4 19V11a8 8 0 0 1 16 0v8l2 3H2l2-3Z" fill="currentColor" /><path d="M9 25h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg> Alertas y observaciones</h2>
        {alertas.length > 3 && <button type="button" onClick={() => setVerTodas(!verTodas)}>{verTodas ? 'Ver menos' : 'Ver todas'} <span aria-hidden="true">→</span></button>}
      </div>
      {alertas.length === 0 ? (
        <div className={styles.sinAlertas}><TrafficLight nivel="green" /><p>Sin alertas activas. Tus indicadores están dentro de los valores esperados.</p></div>
      ) : (
        <ul className={styles.listaAlertas}>
          {visibles.map((alerta, index) => (
            <li key={alerta.ruleId || index}>
              <details>
                <summary>
                  <TrafficLight nivel={alerta.level} conTexto={false} />
                  <span className={styles.alertaTexto}><strong>{alerta.title}</strong><span>{alerta.why}</span></span>
                  <small>Sol {Number.isInteger(alerta.sol) ? alerta.sol : SOL_ACTUAL}</small>
                </summary>
                <div className={styles.detalleAlerta}>
                  <p>{alerta.why}</p>
                  <ul>{(alerta.actions || []).map((accion) => <li key={accion}>{accion}</li>)}</ul>
                  {alerta.nasaSource && <p className={styles.fuente}>Fuente: {alerta.nasaSource}</p>}
                  <OrigenUmbral basis={alerta.basis} className={styles.fuente} />
                  <div className={styles.accionesAlerta}>
                    <Link href={rutaZona(alerta.zone)}>Ver guía →</Link>
                    <Link href="/enlace">Avisar al oficial médico →</Link>
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
