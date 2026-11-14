// POST /api/claude: la IA (Claude Haiku 5.5) con respuestas guardadas de respaldo.
// Toda la lógica vive en ai/ (ver ai/README.md); acá solo se expone como ruta de Next.js.
export { POST } from '@/ai/route.js';

// Necesita Node (SDK de Anthropic, sistema de archivos y la API key del servidor).
export const runtime = 'nodejs';
// Nunca se cachea: cada consulta es distinta.
export const dynamic = 'force-dynamic';
