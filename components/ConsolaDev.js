'use client';

import { useEffect } from 'react';
import * as db from '@/lib/db';
import * as tipos from '@/lib/tipos';
import * as motor from '@/lib/motor/evaluar';
import * as demo from '@/lib/datos/demo';

// Deja la base, los tipos y el motor en `window.astro` y asegura que los 60 soles de demo existan en IndexedDB.
export default function ConsolaDev() {
  useEffect(() => {
    window.astro = { db, tipos, motor, demo };
    demo.asegurarDemo().catch((e) => console.error('No se pudieron inicializar los datos de demo', e));
  }, []);
  return null;
}
