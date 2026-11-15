'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PELIGROS } from '@/lib/content/zones';
import { ZONAS_POR_SECCION, evaluarZonas, zonaMasDelicada } from '@/lib/content/zonasSalud';
import { esZonaValida } from '@/lib/content/rutaZona';
import { SOL_ACTUAL } from '@/lib/datos/demo';
import { ETIQUETAS_NIVEL } from './datos';
import CuerpoAnatomico, { CAPAS, SISTEMA } from './CuerpoAnatomico';
import styles from './MapaZonas.module.scss';

// Icono de Salud que representa cada zona.
const ICONOS = { brain: 'brain', eyes: 'target', inner_ear: 'float', heart: 'heart', lungs: 'lungs', immune: 'shield', kidneys: 'drop', muscles: 'arm', bones: 'bone' };

const TITULOS = {
  fisica: ['Mapa corporal', 'Tocá una zona del cuerpo para ver su función, riesgos, indicadores y qué hacer.'],
  mental: ['Guía: cerebro y mente', 'Función, riesgos e indicadores de la zona que sigue tu salud mental.'],
  riesgos: ['Mapa de peligros', 'Filtrá por peligro de la misión para ver qué zonas del cuerpo afecta.'],
};

function Etiqueta({ nivel, texto }) {
  return <span className={styles.etiqueta} data-nivel={nivel || 'sin-datos'}><i aria-hidden="true" />{texto || ETIQUETAS_NIVEL[nivel] || 'Sin datos'}</span>;
}

/** `zona` llega del `?zona=` de la página; la clave reinicia la selección cuando un enlace pide otra. */
export default function MapaZonas({ zona, ...props }) {
  const parametro = esZonaValida(zona) ? zona : null;
  return <MapaZonasPanel key={parametro || 'sin-zona'} parametro={parametro} {...props} />;
}

function MapaZonasPanel({ seccion, lecturas, sintomas, evaluacion, parametro }) {
  const todas = useMemo(() => evaluarZonas({ lecturas, sintomas, evaluacion, sol: SOL_ACTUAL }), [lecturas, sintomas, evaluacion]);
  const ids = ZONAS_POR_SECCION[seccion];
  const propias = ids ? todas.filter((z) => ids.includes(z.id)) : todas;
  const [elegida, setElegida] = useState(propias.some((z) => z.id === parametro) ? parametro : null);
  const [peligro, setPeligro] = useState(null);
  const [capa, setCapa] = useState('todo');
  const [resaltada, setResaltada] = useState(null);
  const conFiltro = seccion === 'riesgos';
  const visible = (z) => !peligro || z.peligros.includes(peligro);
  const enCapa = (z) => capa === 'todo' || SISTEMA[z.id] === capa;
  const candidatas = propias.filter((z) => visible(z) && enCapa(z));
  const zona = propias.find((z) => z.id === elegida && enCapa(z)) ?? zonaMasDelicada(candidatas.length ? candidatas : propias);

  // Al cambiar de capa, si la elegida queda oculta se pasa a la más delicada de la capa.
  function cambiarCapa(id) {
    setCapa(id);
    const nuevas = propias.filter((z) => id === 'todo' || SISTEMA[z.id] === id);
    if (nuevas.length && !nuevas.some((z) => z.id === zona.id)) setElegida(zonaMasDelicada(nuevas).id);
  }
  const [titulo, bajada] = TITULOS[seccion];

  // El panel se pinta en el cliente (lee ?zona=), así que el navegador no llega a saltar a #mapa solo.
  useEffect(() => {
    if (window.location.hash === '#mapa') document.getElementById('mapa')?.scrollIntoView({ block: 'start' });
  }, []);

  return (
    <section id="mapa" className={styles.mapa} aria-labelledby="titulo-mapa">
      <div className={styles.cabecera}>
        <div>
          <h2 id="titulo-mapa">{titulo}</h2>
          <p>{bajada}</p>
        </div>
        {conFiltro && (
          <div className={styles.filtro} role="group" aria-label="Filtrar por peligro">
            <button type="button" aria-pressed={!peligro} onClick={() => setPeligro(null)}>Todos</button>
            {Object.entries(PELIGROS).map(([k, nombre]) => (
              <button key={k} type="button" aria-pressed={peligro === k} title={nombre} onClick={() => setPeligro(peligro === k ? null : k)}>
                <b>{k}</b> {nombre}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.cuerpo}>
        <div className={styles.silueta}>
          {propias.length > 1 && (
            <div className={styles.capas} role="group" aria-label="Capas del cuerpo">
              {CAPAS.map((c) => (
                <button key={c.id} type="button" aria-pressed={capa === c.id} onClick={() => cambiarCapa(c.id)}>{c.nombre}</button>
              ))}
            </div>
          )}
          <CuerpoAnatomico
            zonas={todas}
            propias={propias.map((z) => z.id)}
            elegida={zona.id}
            onElegir={setElegida}
            capa={capa}
            resaltada={resaltada}
            onResaltar={setResaltada}
            visible={visible}
          />
        </div>

        <div className={styles.detalle}>
          {propias.length > 1 && (
            <div className={styles.chips} role="tablist" aria-label="Zonas del cuerpo" onMouseLeave={() => setResaltada(null)}>
              {propias.map((z) => (
                <button
                  key={z.id}
                  type="button"
                  role="tab"
                  aria-selected={z.id === zona.id}
                  data-nivel={z.nivel}
                  className={visible(z) && enCapa(z) ? undefined : styles.apagada}
                  onClick={() => { if (!enCapa(z)) setCapa('todo'); setElegida(z.id); }}
                  onMouseEnter={() => setResaltada(z.id)}
                >
                  <i aria-hidden="true" />{z.nombre}
                </button>
              ))}
            </div>
          )}

          <article className={styles.ficha} data-nivel={zona.nivel}>
            <header className={styles.fichaTop}>
              <span className={styles.iconoRedondo}><img src={`/figma/salud/${ICONOS[zona.id]}.svg`} width="26" height="26" alt="" /></span>
              <div>
                <h3>{zona.nombre}</h3>
                <p>{zona.funcion}</p>
              </div>
              <Etiqueta nivel={zona.nivel} />
            </header>

            <div className={styles.columnas}>
              <div>
                <h4>Indicadores</h4>
                <ul className={styles.indicadores}>
                  {zona.indicadores.map((i) => (
                    <li key={i.nombre}>
                      <span>{i.nombre}{i.ambiental && <small> · cabina</small>}</span>
                      <strong>{i.valor}</strong>
                      <Etiqueta nivel={i.nivel} />
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4>Riesgos</h4>
                <ul className={styles.lista}>{zona.riesgos.map((r) => <li key={r}>{r}</li>)}</ul>
                <p className={styles.peligros}>
                  {zona.peligros.map((k) => <span key={k} title={PELIGROS[k]}><b>{k}</b> {PELIGROS[k]}</span>)}
                </p>
              </div>
              <div>
                <h4>Qué hacer</h4>
                <ul className={styles.lista}>{zona.queHacer.map((r) => <li key={r}>{r}</li>)}</ul>
              </div>
            </div>

            <footer className={styles.pie}>
              <p className={styles.fuente}>
                Fuente: <a href={zona.fuente.url} target="_blank" rel="noreferrer">{zona.fuente.titulo}</a>
              </p>
              <div className={styles.botones}>
                {zona.enlace && <Link href={zona.enlace.href}>{zona.enlace.etiqueta} →</Link>}
                <Link href="/tendencias">Ver tendencias →</Link>
              </div>
            </footer>
          </article>
        </div>
      </div>
    </section>
  );
}

