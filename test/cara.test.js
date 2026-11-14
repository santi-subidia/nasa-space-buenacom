import assert from 'node:assert/strict';
import { test } from 'node:test';

import { analizarParpadeos, clasificarFatiga } from '../ai/cara/parpadeo.js';
import { extraerCierreBlendshapes } from '../lib/cara/blendshapes.js';

test('extraerCierreBlendshapes promedia eyeBlinkLeft y eyeBlinkRight y devuelve null sin rostro', () => {
  assert.equal(extraerCierreBlendshapes([]), null);
  assert.equal(extraerCierreBlendshapes([{ categories: [{ categoryName: 'jawOpen', score: 0.2 }] }]), null);

  const cierre = extraerCierreBlendshapes([
    {
      categories: [
        { categoryName: 'browInnerUp', score: 0.1 },
        { categoryName: 'eyeBlinkLeft', score: 0.8 },
        { categoryName: 'eyeBlinkRight', score: 0.6 },
      ],
    },
  ]);
  assert.ok(Math.abs(cierre - 0.7) < 1e-9);
});

test('extraerCierreBlendshapes alimenta analizarParpadeos y clasificarFatiga', () => {
  const muestras = [];
  // 12 s a 10 Hz con 3 parpadeos cortos (~200 ms) -> ~15 parpadeos/min (normal)
  for (let ms = 0; ms <= 12_000; ms += 100) {
    const enParpadeo =
      (ms >= 2000 && ms < 2200) ||
      (ms >= 6000 && ms < 6200) ||
      (ms >= 10_000 && ms < 10_200);
    const score = enParpadeo ? 0.85 : 0.05;
    const cierre = extraerCierreBlendshapes([
      {
        categories: [
          { categoryName: 'eyeBlinkLeft', score },
          { categoryName: 'eyeBlinkRight', score },
        ],
      },
    ]);
    muestras.push({ t: ms, cierre });
  }
  const parpadeo = analizarParpadeos(muestras);
  assert.equal(parpadeo.parpadeos, 3);
  assert.equal(parpadeo.cierresLargos, 0);
  assert.equal(clasificarFatiga(parpadeo).nivel, 'normal');
});
