'use client';

import { useEffect } from 'react';
import * as db from '@/lib/db';
import * as tipos from '@/lib/tipos';

// Deja la base y los tipos en `window.astro` para probar desde la consola del navegador:
//   await astro.db.addReading({ astronautId: 'a1', indicator: 'temp', value: 37.6 })
//   await astro.db.getReadings('a1')
export default function ConsolaDev() {
  useEffect(() => {
    window.astro = { db, tipos };
  }, []);
  return null;
}
