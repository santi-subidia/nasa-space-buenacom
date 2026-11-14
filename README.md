# AstroVitals

Compañero de salud para astronautas en misiones largas (NASA Space Apps). **Prototipo educativo; no es un dispositivo médico.**

Stack: **Next.js (App Router) + JavaScript + Sass**. Pensado para notebook (1280×800).

## Correrlo

Requiere Node 20 o superior.

```bash
npm install
npm run dev
```

Abrir <http://localhost:3000>. Otros comandos: `npm run build` y `npm start`.

Para la IA: copiar `.env.example` a `.env.local` y completar la clave. `.env` y `.env.local` están en `.gitignore`.

## Estructura

| Carpeta | Qué hay |
|---|---|
| `app/` | Rutas (una carpeta por pantalla, con su `page.js`) y el layout con la barra lateral |
| `components/` | Componentes compartidos (`Sidebar`, `TrafficLight`, `PantallaVacia`) |
| `lib/rutas.js` | Lista de pantallas de la barra lateral |
| `styles/` | `_tokens.scss` (variables Sass) y `globals.scss` (variables CSS y base) |
| `doc/` | Documentación del desafío, riesgos y plan |

## Estilos

- Cada componente usa su `*.module.scss` y arranca con `@use 'tokens' as *;` (ya resuelve desde `styles/`).
- Colores: fondo `#0A0F1E`, superficies `#121A2E`, acento `#5BC8F5`, IA (Vega) `#A78BFA`.
- Semáforo verde/amarillo/naranja/rojo: **siempre con forma además del color** (● ▲ ◆ ■) — usar `<TrafficLight nivel="..." />`.
- Tipografías: Inter (texto) y Space Grotesk (títulos), cargadas con `next/font`.

## Agregar una pantalla

1. Sumar la entrada en `lib/rutas.js`.
2. Crear `app/<ruta>/page.js`.
