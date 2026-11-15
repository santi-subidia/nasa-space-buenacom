'use client';

import { useRouter } from 'next/navigation';
import { rutaZona } from '@/lib/content/rutaZona';
import { ETIQUETAS_NIVEL } from './datos';
import styles from './CuerpoAnatomico.module.scss';

// Figura anatómica de frente (holograma VYTA). El cuerpo se dibuja en un sistema de 320 de ancho
// centrado en x = 160 y se desplaza 100 a la derecha para dejar columnas de etiquetas a cada lado.
const DX = 100;
const ANCHO = 520;
const ALTO = 620;
const m = (x) => 320 - x; // espejo respecto del eje del cuerpo

/** Sistema al que pertenece cada zona (define las capas). */
export const SISTEMA = {
  brain: 'organos', eyes: 'organos', inner_ear: 'organos', heart: 'organos', lungs: 'organos',
  kidneys: 'organos', immune: 'organos', muscles: 'musculos', bones: 'esqueleto',
};

export const CAPAS = [
  { id: 'todo', nombre: 'All' },
  { id: 'organos', nombre: 'Organs' },
  { id: 'musculos', nombre: 'Muscles' },
  { id: 'esqueleto', nombre: 'Skeleton' },
];

// ── Silueta ────────────────────────────────────────────
// Mitad izquierda (del observador) como curvas cúbicas: [c1, c2, fin]. La derecha se obtiene en espejo.
const INICIO = [160, 22];
const MITAD = [
  [[143, 22], [132, 38], [132, 58]], // cráneo
  [[132, 72], [133, 82], [138, 90]], // mandíbula
  [[142, 97], [146, 101], [150, 104]], // mentón
  [[151, 110], [150, 117], [148, 122]], // cuello
  [[138, 128], [122, 131], [108, 136]], // trapecio
  [[96, 140], [90, 148], [90, 160]], // hombro
  [[89, 185], [85, 210], [84, 232]], // brazo
  [[82, 255], [78, 280], [76, 300]], // antebrazo
  [[74, 318], [68, 338], [72, 350]], // mano (borde externo)
  [[75, 358], [83, 358], [86, 352]], // dedos
  [[90, 338], [93, 318], [92, 302]], // muñeca
  [[93, 280], [98, 258], [102, 236]], // antebrazo interno
  [[105, 215], [108, 195], [110, 178]], // axila
  [[114, 200], [118, 228], [116, 250]], // costado
  [[114, 275], [108, 300], [112, 322]], // cintura → cadera
  [[114, 370], [112, 410], [118, 450]], // muslo → rodilla
  [[121, 490], [118, 535], [124, 570]], // pierna
  [[126, 582], [114, 590], [114, 598]], // tobillo
  [[120, 606], [146, 606], [150, 600]], // pie
  [[152, 592], [148, 580], [148, 570]], // tobillo interno
  [[150, 535], [146, 490], [150, 460]], // pantorrilla interna
  [[152, 420], [154, 380], [158, 352]], // muslo interno
  [[159, 349], [160, 347], [160, 346]], // entrepierna
];

function trazarSilueta() {
  const p = (x, y) => `${x} ${y}`;
  let d = `M${p(...INICIO)}`;
  for (const [c1, c2, fin] of MITAD) d += ` C${p(...c1)} ${p(...c2)} ${p(...fin)}`;
  // Vuelta por la derecha: segmentos en orden inverso y en espejo.
  const puntos = [INICIO, ...MITAD.map((s) => s[2])];
  for (let i = MITAD.length - 1; i >= 0; i--) {
    const [c1, c2] = MITAD[i];
    const desde = puntos[i];
    d += ` C${p(m(c2[0]), c2[1])} ${p(m(c1[0]), c1[1])} ${p(m(desde[0]), desde[1])}`;
  }
  return `${d} Z`;
}
const SILUETA = trazarSilueta();

// ── Formas por zona ────────────────────────────────────
const espejo = (d) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => `${m(Number(x))} ${y}`);
const par = (d) => [d, espejo(d)];
const hueso = (x1, y1, x2, y2, fino = false) => [
  { t: 'line', x1, y1, x2, y2, c: fino ? 'huesoFino' : 'hueso' },
  { t: 'line', x1: m(x1), y1, x2: m(x2), y2, c: fino ? 'huesoFino' : 'hueso' },
];
const forma = (d, c = 'organo') => ({ t: 'path', d, c });

const CEREBRO = 'M160 31 C147 29 139 36 139 44 C139 52 145 57 152 57 C156 57 158 55 160 53 C162 55 164 57 168 57 C175 57 181 52 181 44 C181 36 173 29 160 31 Z';
const OJO = 'M141 66 C145 62 152 62 156 66 C152 70 145 70 141 66 Z';
const OREJA = 'M134 56 C127 54 125 64 127 70 C128 76 132 78 135 77 Z';
const PULMON_IZQ = 'M154 160 C146 152 134 158 128 176 C122 196 120 224 124 246 C132 254 146 252 154 244 C152 222 154 190 154 160 Z';
const PULMON_DER = 'M166 160 C174 152 186 158 192 176 C198 196 200 224 196 246 C188 254 176 252 168 246 C172 238 178 230 178 222 C172 220 166 214 166 206 Z';
const CORAZON = 'M160 198 C152 192 143 200 145 212 C147 226 160 238 174 246 C182 236 190 222 188 208 C186 196 174 192 168 200 C166 196 163 196 160 198 Z';
const RINON = 'M140 266 C131 265 127 275 128 284 C129 294 137 298 143 293 C140 289 139 285 141 282 C143 279 143 271 140 266 Z';

const ZONAS_SVG = {
  brain: {
    ancla: [146, 44],
    el: [
      forma(CEREBRO),
      forma('M160 32 L160 53', 'linea'),
      ...par('M147 37 C151 41 146 45 151 49').map((d) => forma(d, 'linea')),
      ...par('M143 49 C147 50 150 52 153 55').map((d) => forma(d, 'linea')),
    ],
  },
  eyes: {
    ancla: [141, 66],
    el: [...par(OJO).map((d) => forma(d)), { t: 'circle', cx: 148.5, cy: 66, r: 2.2, c: 'punto' }, { t: 'circle', cx: m(148.5), cy: 66, r: 2.2, c: 'punto' }],
  },
  inner_ear: {
    ancla: [m(129), 66],
    el: [
      ...par(OREJA).map((d) => forma(d)),
      forma('M127 66 a3 3 0 1 1 3 3 a1.6 1.6 0 1 1 -1.4 -1.6', 'linea'), // cóclea
      forma('M193 66 a3 3 0 1 0 -3 3 a1.6 1.6 0 1 0 1.4 -1.6', 'linea'),
    ],
  },
  lungs: {
    ancla: [133, 205],
    el: [
      forma(PULMON_IZQ), forma(PULMON_DER),
      forma('M160 108 L160 152', 'tubo'),
      ...par('M160 152 C156 158 152 162 147 172').map((d) => forma(d, 'tubo')),
      ...par('M150 168 C144 176 140 186 138 198').map((d) => forma(d, 'linea')),
    ],
  },
  heart: {
    ancla: [178, 218],
    el: [forma(CORAZON), forma('M164 197 C163 184 177 181 180 192', 'tubo'), forma('M160 206 C163 216 168 226 174 238', 'linea')],
  },
  kidneys: {
    ancla: [m(136), 282],
    el: [
      ...par(RINON).map((d) => forma(d)),
      ...par('M142 284 C148 300 154 316 157 326').map((d) => forma(d, 'linea')),
      { t: 'ellipse', cx: 160, cy: 330, rx: 7, ry: 5, c: 'organo' },
    ],
  },
  immune: {
    ancla: [m(114), 176],
    el: [
      forma('M159 140 C153 140 151 150 153 158 C155 164 159 162 159 156 Z M161 140 C167 140 169 150 167 158 C165 164 161 162 161 156 Z'), // timo
      forma('M190 250 C198 248 202 258 198 266 C194 270 188 266 188 260 Z'), // bazo
      ...par('M148 114 L152 140 M114 176 C126 170 140 160 152 150 M132 330 C138 312 146 300 152 296').map((d) => forma(d, 'vaso')),
      ...[[148, 114], [114, 176], [132, 330], [152, 296]].flatMap(([x, y]) => [
        { t: 'circle', cx: x, cy: y, r: 3.6, c: 'ganglio' },
        { t: 'circle', cx: m(x), cy: y, r: 3.6, c: 'ganglio' },
      ]),
    ],
  },
  muscles: {
    ancla: [97, 205],
    el: [
      ...par('M108 137 C96 139 90 149 90 165 C96 160 104 158 111 160 C112 150 111 142 108 137 Z').map((d) => forma(d, 'musculo')), // deltoides
      ...par('M104 172 C96 176 90 192 91 214 C92 226 96 232 100 232 C104 226 107 210 107 194 C107 182 106 175 104 172 Z').map((d) => forma(d, 'musculo')), // bíceps
      ...par('M100 240 C93 250 86 272 86 292 C90 296 94 294 96 290 C98 274 101 256 100 240 Z').map((d) => forma(d, 'musculo')), // antebrazo
      ...par('M120 342 C116 372 116 410 122 444 C130 448 140 446 146 440 C150 410 152 372 150 352 C142 346 130 342 120 342 Z').map((d) => forma(d, 'musculo')), // cuádriceps
      ...par('M135 350 C134 380 133 410 134 440').map((d) => forma(d, 'fibra')),
      ...par('M122 470 C120 500 122 530 126 556 C130 556 134 552 134 548 C132 520 132 492 130 470 Z').map((d) => forma(d, 'musculo')), // tibial / gemelo
    ],
    // Solo en la capa Músculos (taparían los órganos en la vista completa).
    soloCapa: [
      ...par('M158 140 C140 138 120 142 112 156 C116 172 132 180 158 178 Z').map((d) => forma(d, 'musculo')), // pectoral
      ...[0, 1, 2].flatMap((i) => par(`M158 ${232 + i * 22} L144 ${234 + i * 22} L144 ${252 + i * 22} L158 ${252 + i * 22} Z`).map((d) => forma(d, 'musculo'))), // abdominales
    ],
  },
  bones: {
    ancla: [136, 512],
    el: [
      forma('M160 108 L160 330', 'columna'),
      ...par('M156 134 C140 130 124 132 110 138').map((d) => forma(d, 'huesoFinoPath')), // clavícula
      ...hueso(101, 150, 97, 232), // húmero
      ...hueso(95, 240, 85, 298, true), ...hueso(100, 240, 91, 298, true), // radio y cúbito
      forma('M124 300 C118 318 124 336 140 344 L160 352 L180 344 C196 336 202 318 196 300 C186 312 172 316 160 316 C148 316 134 312 124 300 Z', 'pelvis'),
      ...hueso(131, 338, 138, 446), // fémur
      { t: 'circle', cx: 138, cy: 454, r: 5, c: 'rotula' }, { t: 'circle', cx: m(138), cy: 454, r: 5, c: 'rotula' },
      ...hueso(136, 464, 136, 566), ...hueso(128, 468, 129, 562, true), // tibia y peroné
    ],
    soloCapa: [
      forma('M160 22 C143 22 132 38 132 58 C132 74 138 88 150 96 L170 96 C182 88 188 74 188 58 C188 38 177 22 160 22 Z', 'craneo'),
      ...par('M146 62 C146 58 154 58 155 63 C154 68 147 68 146 62 Z').map((d) => forma(d, 'orbita')),
      { t: 'rect', x: 156, y: 148, width: 8, height: 82, rx: 3, c: 'pelvis' }, // esternón
      ...[0, 1, 2, 3, 4, 5].flatMap((i) => par(`M156 ${156 + i * 14} C140 ${150 + i * 14} 124 ${158 + i * 15} 122 ${176 + i * 15}`).map((d) => forma(d, 'costilla'))),
    ],
  },
};

// Etiquetas: lado y altura de cada una (en coordenadas exteriores).
const ETIQUETAS = {
  brain: { lado: 'izq', y: 40 },
  eyes: { lado: 'izq', y: 92 },
  lungs: { lado: 'izq', y: 196 },
  muscles: { lado: 'izq', y: 262 },
  bones: { lado: 'izq', y: 500 },
  inner_ear: { lado: 'der', y: 60 },
  immune: { lado: 'der', y: 140 },
  heart: { lado: 'der', y: 214 },
  kidneys: { lado: 'der', y: 290 },
};

function Elemento({ e }) {
  const cls = styles[e.c];
  if (e.t === 'line') return <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} className={cls} />;
  if (e.t === 'circle') return <circle cx={e.cx} cy={e.cy} r={e.r} className={cls} />;
  if (e.t === 'ellipse') return <ellipse cx={e.cx} cy={e.cy} rx={e.rx} ry={e.ry} className={cls} />;
  if (e.t === 'rect') return <rect x={e.x} y={e.y} width={e.width} height={e.height} rx={e.rx} className={cls} />;
  return <path d={e.d} className={cls} />;
}

// Marca de estado con la forma del semáforo (nunca solo color).
function Marca({ nivel, x, y }) {
  if (nivel === 'yellow') return <polygon className={styles.marca} points={`${x},${y - 6} ${x + 6},${y + 5} ${x - 6},${y + 5}`} />;
  if (nivel === 'orange') return <polygon className={styles.marca} points={`${x},${y - 7} ${x + 7},${y} ${x},${y + 7} ${x - 7},${y}`} />;
  if (nivel === 'red') return <rect className={styles.marca} x={x - 5.5} y={y - 5.5} width="11" height="11" rx="1.5" />;
  return <circle className={styles.marca} cx={x} cy={y} r="5" />;
}

/**
 * Cuerpo anatómico interactivo.
 * - `zonas`: todas las zonas evaluadas; `propias`: ids que se pueden elegir en esta subcategoría.
 * - Las zonas de otra subcategoría se ven atenuadas y llevan a su sección.
 */
export default function CuerpoAnatomico({ zonas, propias, elegida, onElegir, capa = 'todo', resaltada, onResaltar, visible = () => true }) {
  const router = useRouter();
  const enCapa = (z) => capa === 'todo' || SISTEMA[z.id] === capa;
  const elegir = (z) => (propias.includes(z.id) ? onElegir(z.id) : router.push(rutaZona(z.id)));
  // La zona elegida y la resaltada se dibujan al final para quedar por encima.
  const orden = ['bones', 'muscles', 'kidneys', 'immune', 'lungs', 'heart', 'brain', 'eyes', 'inner_ear'];
  const ordenadas = orden.map((id) => zonas.find((z) => z.id === id)).filter(Boolean);

  return (
    <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className={styles.svg} data-capa={capa} role="group" aria-label="Human body with health zones">
      <defs>
        <linearGradient id="vyta-cuerpo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1b4a73" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#0b2340" stopOpacity="0.35" />
        </linearGradient>
        <filter id="vyta-brillo" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <g transform={`translate(${DX} 0)`}>
        <path d={SILUETA} className={styles.silueta} fill="url(#vyta-cuerpo)" />
        <path d="M160 70 L158 81 L162 82 M154 90 C158 92 162 92 166 90" className={styles.rostro} />

        {ordenadas.map((z) => {
          const g = ZONAS_SVG[z.id];
          const propia = propias.includes(z.id);
          const clases = [
            styles.zona,
            z.id === elegida && styles.sel,
            z.id === resaltada && styles.resaltada,
            (!propia || !visible(z)) && styles.apagada,
            !enCapa(z) && styles.fuera,
          ].filter(Boolean).join(' ');
          const extra = capa === SISTEMA[z.id] ? g.soloCapa || [] : [];
          return (
            <g
              key={z.id}
              className={clases}
              data-nivel={z.nivel}
              onClick={() => elegir(z)}
              onMouseEnter={() => onResaltar?.(z.id)}
              onMouseLeave={() => onResaltar?.(null)}
              aria-hidden="true"
            >
              {[...extra, ...g.el].map((e, i) => <Elemento key={i} e={e} />)}
            </g>
          );
        })}
      </g>

      {/* Etiquetas con línea guía: son los controles accesibles (uno por zona). */}
      {zonas.filter((z) => propias.includes(z.id)).map((z) => {
        const { lado, y } = ETIQUETAS[z.id];
        const [ax, ay] = ZONAS_SVG[z.id].ancla;
        const izq = lado === 'izq';
        const x0 = ax + DX;
        const marcaX = izq ? 160 : 360;
        const codo = izq ? marcaX + 22 : marcaX - 22;
        const textoX = izq ? 150 : 370;
        const sel = z.id === elegida;
        const clases = [styles.etiqueta, sel && styles.sel, z.id === resaltada && styles.resaltada, !visible(z) && styles.apagada, !enCapa(z) && styles.fuera].filter(Boolean).join(' ');
        const estado = ETIQUETAS_NIVEL[z.nivel] || 'No data';
        return (
          <g
            key={z.id}
            className={clases}
            data-nivel={z.nivel}
            role="button"
            tabIndex={enCapa(z) ? 0 : -1}
            aria-pressed={sel}
            aria-label={`${z.nombre}: ${estado}`}
            onClick={() => onElegir(z.id)}
            onMouseEnter={() => onResaltar?.(z.id)}
            onMouseLeave={() => onResaltar?.(null)}
            onFocus={() => onResaltar?.(z.id)}
            onBlur={() => onResaltar?.(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onElegir(z.id);
              }
            }}
          >
            <path className={styles.guia} d={`M${x0} ${ay} L${codo} ${y} L${izq ? marcaX + 8 : marcaX - 8} ${y}`} />
            <circle className={styles.origen} cx={x0} cy={ay} r="2.6" />
            <rect className={styles.area} x={izq ? 6 : 350} y={y - 18} width="164" height="40" rx="8" />
            <Marca nivel={z.nivel} x={marcaX} y={y} />
            <text className={styles.nombre} x={textoX} y={y - 1} textAnchor={izq ? 'end' : 'start'}>{z.nombre}</text>
            <text className={styles.estado} x={textoX} y={y + 14} textAnchor={izq ? 'end' : 'start'}>{estado}</text>
          </g>
        );
      })}
    </svg>
  );
}
