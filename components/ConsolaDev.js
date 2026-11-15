'use client';

import { useEffect } from 'react';
import * as db from '@/lib/db';
import * as tipos from '@/lib/tipos';
import * as motor from '@/lib/motor/evaluar';
import * as demo from '@/lib/datos/demo';
import { silenciarLogsMediaPipe } from '@/lib/mediapipe/silenciarLogs';

if (typeof window !== 'undefined') {
  silenciarLogsMediaPipe();
}

// Deja la base, los tipos y el motor en `window.astro` y asegura que los 60 soles de demo existan en IndexedDB.
export default function ConsolaDev() {
  useEffect(() => {
    silenciarLogsMediaPipe();
    window.astro = { db, tipos, motor, demo };
    demo.asegurarDemo().catch((e) => console.error('Failed to initialize demo data', e));
  }, []);
  return null;
}
