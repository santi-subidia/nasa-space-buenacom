import { crearRutasVoz } from '@/ai/voz/servidor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const POST = crearRutasVoz().responder;
