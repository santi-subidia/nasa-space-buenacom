import { NIVELES } from '@/lib/niveles';
import { TIPOS_NODO } from '@/lib/causas/grafos';
import styles from './Causas.module.scss';

// Dibujo del grafo causal: columnas de izquierda (peligros) a derecha (misión).
// Las flechas encendidas son el camino que siguió la alerta de hoy.
const ANCHO_COL = 172;
const ALTO_FILA = 106;
const NODO_W = 152;
const NODO_H = 88;
const MARGEN_X = 10;
const MARGEN_Y = 34;

const COLOR = {
  green: 'var(--color-verde)',
  yellow: 'var(--color-amarillo)',
  orange: 'var(--color-naranja)',
  red: 'var(--color-rojo)',
};

const centro = (n) => ({
  x: MARGEN_X + n.col * ANCHO_COL + NODO_W / 2,
  y: MARGEN_Y + n.fila * ALTO_FILA + NODO_H / 2,
});

function camino(origen, destino) {
  const a = centro(origen);
  const b = centro(destino);
  if (origen.col === destino.col) {
    const y1 = a.y + NODO_H / 2;
    const y2 = b.y - NODO_H / 2 - 4;
    return `M ${a.x} ${y1} L ${b.x} ${y2}`;
  }
  const x1 = a.x + NODO_W / 2;
  const x2 = b.x - NODO_W / 2 - 4;
  const curva = Math.max(30, (x2 - x1) / 2);
  return `M ${x1} ${a.y} C ${x1 + curva} ${a.y}, ${x2 - curva} ${b.y}, ${x2} ${b.y}`;
}

// La misma forma por nivel que el semáforo y el mapa (accesible sin color).
function Forma({ nivel }) {
  const c = COLOR[nivel];
  if (nivel === 'yellow') return <polygon points="7,1 13,12 1,12" fill={c} />;
  if (nivel === 'orange') return <polygon points="7,0 14,7 7,14 0,7" fill={c} />;
  if (nivel === 'red') return <rect x="1" y="1" width="12" height="12" rx="2" fill={c} />;
  return <circle cx="7" cy="7" r="6" fill={c} />;
}

export default function GrafoCausal({ grafo }) {
  const porId = new Map(grafo.nodos.map((n) => [n.id, n]));
  const columnas = Math.max(...grafo.nodos.map((n) => n.col)) + 1;
  const filas = Math.max(...grafo.nodos.map((n) => n.fila)) + 1;
  const ancho = MARGEN_X * 2 + (columnas - 1) * ANCHO_COL + NODO_W;
  const alto = MARGEN_Y + (filas - 1) * ALTO_FILA + NODO_H + 8;

  const descripcion = grafo.camino.length
    ? `Camino encendido hoy: ${grafo.camino.join(' → ')}.`
    : 'Hoy ningún factor de esta cadena está fuera de rango.';

  return (
    <figure className={styles.figura}>
      <svg viewBox={`0 0 ${ancho} ${alto}`} className={styles.svg} role="img" aria-label={`${grafo.titulo} ${descripcion}`}>
        <defs>
          {['activa', 'inactiva'].map((k) => (
            <marker key={k} id={`flecha-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" className={k === 'activa' ? styles.puntaActiva : styles.puntaInactiva} />
            </marker>
          ))}
        </defs>

        {grafo.columnas.map((titulo, i) => (
          <text key={titulo} x={MARGEN_X + i * ANCHO_COL + NODO_W / 2} y={14} textAnchor="middle" className={styles.columna}>
            {titulo}
          </text>
        ))}

        {/* Primero las inactivas, para que el camino encendido quede arriba. */}
        {[...grafo.aristas]
          .sort((x, y) => Number(x.activa) - Number(y.activa))
          .map((e) => (
            <path
              key={`${e.de}-${e.a}`}
              d={camino(porId.get(e.de), porId.get(e.a))}
              className={e.activa ? styles.aristaActiva : styles.aristaInactiva}
              markerEnd={`url(#flecha-${e.activa ? 'activa' : 'inactiva'})`}
            />
          ))}

        {grafo.nodos.map((n) => {
          const { x, y } = centro(n);
          const borde = n.estado === 'activo' && n.nivel ? COLOR[n.nivel] : undefined;
          return (
            <g key={n.id} transform={`translate(${x - NODO_W / 2} ${y - NODO_H / 2})`}>
              <foreignObject width={NODO_W} height={NODO_H}>
                <div
                  className={[styles.nodo, styles[n.tipo], styles[n.estado]].join(' ')}
                  style={borde ? { borderColor: borde } : undefined}
                  title={`${TIPOS_NODO[n.tipo]} · NASA: ${n.nasa}`}
                >
                  <div className={styles.nodoTop}>
                    {n.tipo === 'peligro' && <span className={styles.letra}>{n.peligro}</span>}
                    {n.estado === 'activo' && n.nivel && (
                      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className={styles.forma}>
                        <Forma nivel={n.nivel} />
                      </svg>
                    )}
                    <strong>{n.etiqueta}</strong>
                  </div>
                  {n.valor && <span className={styles.valor}>{n.valor}</span>}
                  {n.estado === 'activo' && n.nivel && <span className={styles.oculto}>{NIVELES[n.nivel].etiqueta}</span>}
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>
      <figcaption className={styles.caption}>{descripcion}</figcaption>
    </figure>
  );
}
