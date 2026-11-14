import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DIMENSION_EMBEDDING,
  formatearVectorPg,
  generarEmbedding384,
  normalizarTexto,
  similitudCoseno,
} from '../lib/rag/embeddings.js';
import { estaSupabaseConfigurado, obtenerSupabaseCliente } from '../lib/supabase/cliente.js';
import { obtenerPerfilPorEmail, obtenerPerfilPorId, PERFILES_DEMO } from '../lib/auth/sesion.js';

test('normalizarTexto limpia tildes, puntuación y palabras vacías', () => {
  const tokens = normalizarTexto('Reactivación viral: ¡Herpes labial e inmunidad!');
  assert.ok(tokens.includes('reactivacion'));
  assert.ok(tokens.includes('viral'));
  assert.ok(tokens.includes('herpes'));
  assert.ok(tokens.includes('inmunidad'));
  assert.equal(tokens.includes('e'), false);
});

test('generarEmbedding384 devuelve un vector L2-normalizado de 384 dimensiones', () => {
  const vec = generarEmbedding384('Sistema inmune alterado y herpes labial por estrés');
  assert.equal(vec.length, DIMENSION_EMBEDDING);
  const norma = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0));
  assert.ok(Math.abs(norma - 1) < 0.01, `Norma esperada ~1, obtenida ${norma}`);
  const pg = formatearVectorPg(vec);
  assert.ok(pg.startsWith('[') && pg.endsWith(']'));
});

test('similitudCoseno rankea protocolos afines por encima de otros no relacionados', () => {
  const consulta = generarEmbedding384('herpes labial virus inmunidad estres');
  const docInmune = generarEmbedding384(
    'Riesgo de sistema inmune alterado. Herpes labial y virus latentes que se reactivan con estres y mal sueno.'
  );
  const docHueso = generarEmbedding384(
    'Riesgo de fractura osea por perdida mineral en microgravedad y ejercicio resistivo con calcio.'
  );

  const simInmune = similitudCoseno(consulta, docInmune);
  const simHueso = similitudCoseno(consulta, docHueso);
  assert.ok(simInmune > simHueso, `Esperado ${simInmune} > ${simHueso}`);
});

test('el cliente de Supabase y perfiles de sesión no rompen en modo offline sin credenciales', () => {
  if (!estaSupabaseConfigurado()) {
    assert.equal(obtenerSupabaseCliente(), null);
  }
  assert.equal(PERFILES_DEMO.length, 3);
  const houston = obtenerPerfilPorEmail('elena.vance@houston.nasa.gov');
  assert.equal(houston?.rol, 'houston');
  assert.equal(obtenerPerfilPorId('elena').rutaInicial, '/houston');
});
