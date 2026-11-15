import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { getDb, resetDb, addReading, getReadings } from '../lib/db.js';
import { evaluate } from '../lib/motor/evaluar.js';
import { guardarEnvioCanal, sincronizarCanal } from '../lib/enlace/canal.js';
import { publicarTransmisionEnlaceRemota } from '../lib/supabase/sincronizar.js';
import { agruparMensajesPorDia, crearTransmisionCanal, informeDesdeRegistros, juntaDelTripulante, mensajesDeTransmisiones } from '../lib/enlace/informes.js';

const ana = { id: 'ana', name: 'Nicolás Méndez' };
const marcos = { id: 'marcos', name: 'Marcos Silva' };
beforeEach(async () => { await resetDb(); });

test('Informes tolera el estado inicial sin tripulante mientras la base de datos se carga', () => {
  const informe = informeDesdeRegistros({ astronauta: null, sol: 43 });
  assert.equal(informe.disponible, false);
  assert.equal(informe.sol, 43);
  assert.deepEqual(informe.hallazgos, []);
  assert.deepEqual(informe.plan, []);
});

test('Informes usa las mediciones guardadas del tripulante y las indicaciones del motor', async () => {
  await addReading({ astronautId: 'ana', indicator: 'temp', value: 37.8, sol: 42 });
  await addReading({ astronautId: 'ana', indicator: 'stress', value: 8, sol: 42 });
  await addReading({ astronautId: 'ana', indicator: 'temp', value: 36, sol: 50 });
  await addReading({ astronautId: 'marcos', indicator: 'temp', value: 36.5, sol: 42 });
  const lecturas = await getReadings('ana');
  const evaluacion = evaluate(lecturas, {}, 'mars_base', { sol: 42 });
  const informe = informeDesdeRegistros({ astronauta: ana, lecturas, evaluacion, sol: 42 });
  assert.match(informe.resumen, /Nicolás Méndez/);
  assert.match(informe.resumen, /37\.8/);
  assert.doesNotMatch(informe.resumen, /36\.5|121\/78|herpes|cold sore/i);
  assert.deepEqual(informe.hallazgos, evaluacion.alerts.map((a) => a.why));
  assert.deepEqual(informe.plan, [...new Set(evaluacion.alerts.flatMap((a) => a.actions))]);
  assert.equal(informe.disponible, true);
});

test('Junta respeta el tripulante y el sol, y los campos vacíos no se completan con el caso de muestra', () => {
  assert.equal(juntaDelTripulante({ astronauta: { id: 'marcos' }, sol: 42 }, 'ana', 42), false);
  assert.equal(juntaDelTripulante({ astronauta: 'ana', sol: 43 }, 'ana', 42), false);
  assert.equal(juntaDelTripulante({ astronauta: 'ana', sol: 41 }, 'ana', 42), true);
  const junta = { ts: '2026-11-14T12:00:00Z', input: { astronauta: 'marcos', sol: 42 }, output: { json: {
    sintesis: { nivel: 'green' }, informe_tecnico: { resumen_clinico: 'Informe guardado de Marcos.' },
  } } };
  const informe = informeDesdeRegistros({ astronauta: marcos, sol: 42, junta });
  assert.equal(informe.resumen, 'Informe guardado de Marcos.');
  assert.equal(informe.astronauta, 'Marcos Silva');
  assert.deepEqual(informe.hallazgos, []);
  assert.deepEqual(informe.plan, []);
  const vacio = informeDesdeRegistros({ astronauta: ana, sol: 42 });
  assert.equal(vacio.disponible, false);
  assert.deepEqual(vacio.plan, []);
});

test('el canal conserva envíos, separa tripulantes y no presenta respuestas pendientes como recibidas', async () => {
  const primero = crearTransmisionCanal({ texto: 'Mensaje real de Nicolás', astronauta: ana, sol: 42, id: '1', ts: '2026-11-15T01:00:00Z' });
  const segundo = crearTransmisionCanal({ texto: 'Mensaje de Marcos', astronauta: marcos, sol: 42, id: '2', ts: '2026-11-15T01:01:00Z' });
  await guardarEnvioCanal(primero);
  await guardarEnvioCanal(segundo);
  await assert.rejects(guardarEnvioCanal({ ...primero, resumen_tecnico: 'Duplicado' }), { name: 'ConstraintError' });
  const respuesta = { resumenTecnico: 'Respuesta guardada en Tierra', indicaciones: ['Indicación guardada'] };
  const filas = await getDb().transmisionesEnlace.toArray();
  let mensajes = mensajesDeTransmisiones(filas.map((f) => ({ ...f, respuesta_medica: respuesta })), 'ana');
  assert.equal(mensajes.length, 1);
  assert.equal(mensajes[0].texto, 'Mensaje real de Nicolás');
  assert.equal(mensajes[0].entrega, 'pendiente');
  assert.equal(mensajes[0].enviado, false);
  assert.equal(mensajes[0].recibidoEnDestino, false);
  mensajes = mensajesDeTransmisiones([{ ...primero, estado: 'recibido', respuesta_medica: respuesta, actualizado_en: '2026-11-15T01:04:00Z' }], 'ana');
  assert.equal(mensajes.length, 2);
  assert.equal(mensajes[1].texto, respuesta.resumenTecnico);
  assert.equal(mensajes[1].enviado, true);
  assert.equal(mensajes[1].recibidoEnDestino, true);
  assert.deepEqual(mensajes[1].indicaciones, respuesta.indicaciones);
  const grupos = agruparMensajesPorDia(mensajes);
  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].entrada.length, 1);
  assert.equal(grupos[0].salida.length, 1);
});

test('los puntos distinguen envío y recepción en Tierra sin esperar a la respuesta médica', () => {
  const envio = crearTransmisionCanal({ texto: 'Mensaje', astronauta: ana, sol: 42, id: 'entrega' });
  const enViaje = mensajesDeTransmisiones([{ ...envio, sincronizacion: 'enviado', estado: 'viajando_ida' }], 'ana')[0];
  assert.equal(enViaje.enviado, true);
  assert.equal(enViaje.recibidoEnDestino, false);

  for (const estado of ['en_houston', 'viajando_vuelta', 'recibido']) {
    const enTierra = mensajesDeTransmisiones([{ ...envio, sincronizacion: 'enviado', estado }], 'ana')[0];
    assert.equal(enTierra.enviado, true);
    assert.equal(enTierra.recibidoEnDestino, true);
  }

  const antiguo = { ...envio, estado: 'en_houston' };
  delete antiguo.sincronizacion;
  const legado = mensajesDeTransmisiones([antiguo], 'ana')[0];
  assert.equal(legado.enviado, true);
  assert.equal(legado.recibidoEnDestino, true);
});

test('Enviar informe conserva el contenido clínico y los envíos reintentados no sobrescriben una respuesta de Houston', async () => {
  const informe = { titulo: 'Junta actual', resumen: 'Resumen clínico guardado', hallazgos: ['Hallazgo real'], plan: ['Plan guardado'], nivel: 'yellow' };
  const envio = crearTransmisionCanal({ informe, astronauta: ana, sol: 42, id: 'prueba' });
  const existente = { ...envio, estado: 'recibido', respuesta_medica: { resumenTecnico: 'Dictamen recibido' } };
  const escrituras = [];
  const cliente = { from(tabla) {
    assert.equal(tabla, 'transmisiones_enlace');
    return {
      upsert(fila, opciones) {
        escrituras.push({ fila, opciones });
        return { async abortSignal() { return { error: null }; } };
      },
      select() { return { eq() { return { maybeSingle() { return { async abortSignal() { return { data: existente }; } }; } }; } }; },
    };
  } };
  assert.equal((await publicarTransmisionEnlaceRemota(envio, cliente)).estado, 'recibido');
  await publicarTransmisionEnlaceRemota(envio, cliente);
  assert.equal(escrituras[0].fila.resumen_tecnico, informe.resumen);
  assert.deepEqual(escrituras[0].fila.plan_sugerido, informe.plan);
  assert.equal(escrituras[0].opciones.ignoreDuplicates, true);
  assert.equal(escrituras[0].fila.id, escrituras[1].fila.id);
  assert.equal(Object.hasOwn(escrituras[0].fila, 'respuesta_medica'), false);
  assert.equal(Object.hasOwn(escrituras[0].fila, 'traduccion_vega'), false);
});

test('sin Supabase el mensaje queda pendiente en IndexedDB y no se inyecta una conversación de respaldo', async () => {
  const envio = crearTransmisionCanal({ texto: 'Pendiente local', astronauta: ana, sol: 42, id: 'local' });
  await guardarEnvioCanal(envio);
  const resultado = await sincronizarCanal('ana');
  assert.equal(resultado.ok, false);
  assert.deepEqual(resultado.datos, []);
  const filas = await getDb().transmisionesEnlace.toArray();
  assert.equal(filas.length, 1);
  assert.equal(filas[0].sincronizacion, 'pendiente');
});
