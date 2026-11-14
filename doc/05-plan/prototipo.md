# Especificación del prototipo

## 1. Stack recomendado (rápido para un hackathon, funciona sin conexión)

| Capa | Opción | Por qué |
|---|---|---|
| Frontend | **React + Vite + TypeScript** (o Svelte) | Rápido y con buen ecosistema |
| UI | Tailwind + componentes propios | Controles grandes y temas claro/oscuro |
| Gráficos | **Recharts** o Chart.js | Líneas con bandas de referencia |
| Mapa corporal | **SVG** con `<path id="heart">` clicables (extra: Three.js / react-three-fiber) | Barato y responsive |
| Almacenamiento | **IndexedDB** (Dexie) + PWA (service worker) | **Sin conexión**: la nave no tiene internet |
| Lógica | Motor de reglas en TS puro + `rules.json` | Testeable y editable por el equipo de contenido |
| Cámara | `getUserMedia` | Foto de la piel / test visual |
| Despliegue | Vercel / GitHub Pages | Demo pública |

## 2. Modelo de datos (mínimo)

```ts
type Env = 'transit_0g' | 'station' | 'rover_eva' | 'moon_base' | 'mars_base';

interface Astronaut { id: string; name: string; role: 'crew' | 'cmo'; baseline: Partial<Record<IndicatorId, number>>; }

type IndicatorId =
  | 'bp_sys' | 'bp_dia' | 'hr_rest' | 'glucose' | 'temp' | 'sleep_h' | 'mood'
  | 'spo2' | 'water_ml' | 'exercise_min' | 'stress' | 'visual_acuity' | 'reaction_ms'
  | 'mass_kg' | 'kcal' | 'radiation_msv';

interface Reading { id: string; astronautId: string; indicator: IndicatorId; value: number;
  unit: string; ts: string /* ISO, hora de misión */; source: 'manual' | 'device' | 'camera'; note?: string; }

interface Symptom { id: string; astronautId: string; bodyZone: BodyZone; code: string /* 'rash','dizzy_standing','neck_swelling' */;
  severity: 1 | 2 | 3; ts: string; photoBlobId?: string; }

type BodyZone = 'brain' | 'eyes' | 'inner_ear' | 'heart' | 'lungs' | 'immune' | 'bones' | 'muscles' | 'kidneys' | 'gut' | 'dna' | 'whole';

type Level = 'green' | 'yellow' | 'orange' | 'red';

interface Alert { id: string; level: Level; zone: BodyZone; ruleId: string; title: string;
  why: string; actions: string[]; escalate: 'self' | 'cmo' | 'flight_surgeon'; nasaSource: string; ts: string; }
```

## 3. Motor de reglas (`rules.json`)

```json
{
  "thresholds": {
    "temp":    { "zone": "immune", "green": [36.1, 37.2], "yellow": [37.3, 37.9], "red_gte": 38.0, "unit": "°C",
                 "source": "fuentes/02-riesgos/risk-of-altered-immune-system-responses.md" },
    "sleep_h": { "zone": "brain",  "green": [7, 9], "yellow": [6, 7], "red_lt": 5, "unit": "h",
                 "source": "fuentes/02-riesgos/risk-from-inadequate-sleep-and-irregular-schedules.md" },
    "spo2":    { "zone": "lungs",  "green": [95, 100], "yellow": [90, 94], "red_lt": 90, "unit": "%",
                 "source": "fuentes/02-riesgos/risk-of-hypoxia.md" }
  },
  "baselineDelta": { "hr_rest": { "yellow": 10, "orange": 20 } },
  "composite": [
    { "id": "viral_reactivation",
      "when": "avg(sleep_h,3d) < 6 && avg(stress,3d) >= 7 && symptom('rash'|'cold_sore',3d)",
      "level": "orange", "zone": "immune", "escalate": "cmo",
      "title": "Posible reactivación viral",
      "actions": ["Higiene y no compartir utensilios", "Priorizar 8 h de sueño", "Avisar al oficial médico"] },
    { "id": "orthostatic_pre_landing",
      "when": "env_event('landing', 72h) && trend(bp_sys,5d) < 0 && avg(water_ml,2d) < 1500",
      "level": "yellow", "zone": "heart", "escalate": "self",
      "title": "Riesgo de mareo al aterrizar",
      "actions": ["Beber líquidos según el protocolo", "Preparar la prenda de compresión"] },
    { "id": "jugular_vte",
      "when": "symptom('neck_swelling'|'arm_swelling')",
      "level": "red", "zone": "heart", "escalate": "flight_surgeon",
      "title": "Posible trombo venoso",
      "actions": ["No hacer esfuerzo", "Ecografía guiada del cuello", "Contactar con los médicos de vuelo"] }
  ],
  "envModifiers": { "mars_base": { "commDelayMin": [4, 20], "escalateAlsoTo": "cmo" } }
}
```

**Algoritmo:**

1. Para cada indicador, toma el último valor y la tendencia de 7 días, y calcula el nivel con los umbrales y la diferencia respecto a la línea base.
2. Evalúa las reglas compuestas.
3. El estado de cada zona corporal es el **máximo** de los niveles de sus indicadores y alertas.
4. El estado global es el máximo de las zonas.
5. Cada alerta incluye `why` + `actions` + `nasaSource` (trazabilidad).

## 4. Pantallas (wireframe textual)

```
┌──────────── INICIO ────────────┐   ┌──────── MAPA CORPORAL ────────┐
│ Día 42 · Base Marte · ⏱ 14 min │   │        (silueta SVG)          │
│  Estado general:  🟠           │   │   🧠🟢  👁️🟡                  │
│  ▸ Posible reactivación viral  │   │   🫀🟢  🫁🟢  🛡️🟠            │
│    [Ver guía] [Avisar al CMO]  │   │   🦴🟡  💪🟡  🫘🟢             │
│  Hoy: ☐ PA  ☐ Temp ☐ Ánimo     │   │ Tap 🛡️ → Inmunidad: función,  │
│  Racha ejercicio 🔥 12 días     │   │ riesgos, gráficos, consejos ⓘ │
└────────────────────────────────┘   └───────────────────────────────┘
┌──────────── REGISTRO ──────────┐   ┌──────────── TENDENCIAS ───────┐
│ PA [118]/[76]  FC [64]         │   │ Sueño ▁▃▅▃▂▁▁  (banda 7–9 h)  │
│ Temp [37.6]  Sueño ◀──●──▶ 5.5h│   │ Ánimo 😀😐😐🙁🙁              │
│ Ánimo 😞🙁😐🙂😀  📷 Foto piel   │   │ [Comparar: sueño vs estrés]   │
└────────────────────────────────┘   └───────────────────────────────┘
```

## 5. Datos de demostración: la historia "Día 42 en Marte"

- **Días 1–30:** todo verde; ejercicio cumplido (racha).
- **Días 31–40:** carga de trabajo alta, el sueño baja a ~5,5 h y el estrés sube a 7–8 → 🟡 sueño.
- **Día 41:** herpes labial (foto) + temperatura de 37,6 °C → regla `viral_reactivation` → 🟠 se avisa al oficial médico.
- **Día 42:** el astronauta abre la app, ve el escudo 🛡️ en naranja, lee la guía y envía un informe a tierra (retraso de 14 min). Recibe la respuesta del médico de vuelo.
- **Cierre:** el panel de tripulación muestra que los demás siguen en verde; desbloquea la medalla "Ritmo recuperado" tras 3 noches de más de 7 h.

Generador: un script que produce `demo-data.json` con ruido realista alrededor de la línea base.

## 6. Estructura del repositorio sugerida

```
astrovitals/
├─ src/
│  ├─ engine/ (rules.json, evaluate.ts, evaluate.test.ts)
│  ├─ data/ (db.ts, demo-data.json, generateDemo.ts)
│  ├─ components/ (BodyMap.tsx, TrafficLight.tsx, TrendChart.tsx, InfoCard.tsx)
│  ├─ pages/ (Home, Log, Body, Trends, Alerts, Crew, Comms, Learn)
│  └─ content/ (educativo por zona/indicador, con enlaces a la NASA)
├─ public/ (body.svg, manifest.webmanifest)
└─ README.md
```

## 7. Checklist de entrega en Space Apps

- [ ] Demo desplegada (URL).
- [ ] Repositorio público.
- [ ] Video de ≤ 30 s (o lo que pidan las reglas del año).
- [ ] Descripción del proyecto, **recursos de la NASA usados** (HRP: hazards, risks, ongoing research) y uso de IA, si se usó.
- [ ] Aviso: "Prototipo educativo; no es un dispositivo médico".
