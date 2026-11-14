import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  claveDeEntrada,
  crearAlmacenEnArchivo,
  RUTA_POR_DEFECTO,
  RUTA_RESPALDO_DEMO,
} from '../ai/almacen.js';
import { consultarClaude } from '../ai/claude.js';
import { INTENSIDADES } from '../ai/entrenador/plan.js';
import { ENTRADA_SOL42 } from '../ai/junta/ejemplo-sol42.js';
import { ESPECIALISTAS_JUNTA, revisarSalida } from '../ai/junta/esquema.js';
import { construirTarea } from '../ai/tareas.js';
import { SUGERENCIAS } from '../ai/vega/sesion.js';
import { citasUsadas } from '../ai/vega/texto.js';
import { RUTAS } from '../lib/rutas.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

test('ai/respaldo-demo.json existe y contiene entradas válidas para answer, board y exercise', () => {
  assert.equal(existsSync(RUTA_RESPALDO_DEMO), true);
  const entradas = JSON.parse(readFileSync(RUTA_RESPALDO_DEMO, 'utf8'));
  assert.ok(Array.isArray(entradas));

  for (const item of entradas) {
    assert.ok(item.id);
    assert.ok(['answer', 'board', 'exercise'].includes(item.kind));
    assert.equal(item.clave, claveDeEntrada(item.input));
    assert.ok(item.output);
    assert.ok(item.ts);
  }

  const answers = entradas.filter((e) => e.kind === 'answer');
  const preguntas = answers.map((a) => a.input?.pregunta);
  for (const s of SUGERENCIAS) {
    assert.ok(preguntas.includes(s), `Falta sugerencia "${s}" en respaldo-demo.json`);
  }
  assert.ok(preguntas.includes('¿Por qué me salió herpes labial?'));

  const boards = entradas.filter((e) => e.kind === 'board');
  assert.ok(boards.length >= 1);
  assert.equal(revisarSalida(boards[0].output.json), null);

  const exercises = entradas.filter((e) => e.kind === 'exercise');
  assert.ok(exercises.length >= 1);
  const ex = exercises[0];
  assert.equal(ex.input.ejercicio, 'sentadilla');
  assert.equal(ex.input.nivelMotor, 'orange');
  assert.equal(ex.output.json.plan.minutos, 20);
  assert.ok(INTENSIDADES.includes(ex.output.json.plan.intensidad));
  assert.equal(ex.output.json.plan.intensidad, 'liviana');
});

test('crearAlmacenEnArchivo() precarga respaldo-demo.json solo en RUTA_POR_DEFECTO', () => {
  assert.ok(RUTA_POR_DEFECTO);
  const porDefecto = crearAlmacenEnArchivo();
  assert.ok(porDefecto.listar('answer').length >= 5);
  assert.ok(porDefecto.listar('board').length >= 1);
  assert.ok(porDefecto.listar('exercise').length >= 1);

  const carpeta = mkdtempSync(join(tmpdir(), 'astrovitals-entrega-'));
  try {
    const aislado = crearAlmacenEnArchivo(join(carpeta, 'ai-results.json'));
    assert.equal(aislado.listar().length, 0);
  } finally {
    rmSync(carpeta, { recursive: true, force: true });
  }
});

test('con IA_APAGADA=1 y crearAlmacenEnArchivo(), Vega responde las 4 SUGERENCIAS con coincidencia exacta y citas NASA', async () => {
  const almacen = crearAlmacenEnArchivo();
  const preguntas = [...SUGERENCIAS, '¿Por qué me salió herpes labial?'];

  for (const pregunta of preguntas) {
    const tarea = construirTarea({ tipo: 'answer', pregunta });
    const res = await consultarClaude(tarea, { almacen, env: { IA_APAGADA: '1' } });
    assert.equal(res.ok, true, pregunta);
    assert.equal(res.origen, 'guardada', pregunta);
    assert.equal(res.motivo, 'ia_apagada', pregunta);
    assert.equal(res.exacta, true, pregunta);

    const usadas = citasUsadas(res.texto, tarea.citas);
    assert.ok(usadas.length >= 1, `Sin citas NASA usadas para "${pregunta}"`);
    assert.ok(usadas[0].url.startsWith('https://www.nasa.gov/'));
  }
});

test('con IA_APAGADA=1 y crearAlmacenEnArchivo(), la junta médica del Sol 42 devuelve los 5 especialistas válidos', async () => {
  const almacen = crearAlmacenEnArchivo();
  const tarea = construirTarea({ tipo: 'board', ...ENTRADA_SOL42 });
  const res = await consultarClaude(tarea, { almacen, env: { IA_APAGADA: '1' } });

  assert.equal(res.ok, true);
  assert.equal(res.origen, 'guardada');
  assert.equal(res.motivo, 'ia_apagada');
  assert.equal(res.exacta, true);
  assert.equal(revisarSalida(res.json), null);

  const procesada = tarea.procesar(res);
  assert.equal(procesada.nivelFinal, 'orange');
  assert.equal(procesada.accionFinal, 'avisar_oficial_medico');
  assert.deepEqual(
    procesada.junta.especialistas.map((e) => e.id),
    ESPECIALISTAS_JUNTA,
  );
  assert.ok(procesada.junta.informe_astronauta.titulo);
  assert.ok(procesada.junta.informe_tecnico.resumen_clinico);
});

test('con IA_APAGADA=1 y crearAlmacenEnArchivo(), sentadillas Sol 42 en nivel orange ajusta a 20 min liviana', async () => {
  const almacen = crearAlmacenEnArchivo();
  const tarea = construirTarea({
    tipo: 'exercise',
    ejercicio: 'sentadilla',
    metricas: { repeticiones: 12, anguloRodillaMin: 88, correccionesEnVivo: 2 },
    estado: { nivelMotor: 'orange', resumen: 'Febrícula de 37,6 °C y herpes labial; sueño de 5,3 h.' },
  });
  const res = await consultarClaude(tarea, { almacen, env: { IA_APAGADA: '1' } });

  assert.equal(res.ok, true);
  assert.equal(res.origen, 'guardada');
  assert.equal(res.motivo, 'ia_apagada');
  assert.equal(res.exacta, true);

  const procesada = tarea.procesar(res);
  assert.equal(procesada.comentarioDeIA, true);
  assert.equal(procesada.plan.minutos, 20);
  assert.equal(procesada.plan.intensidad, 'liviana');
  assert.equal(procesada.plan.limitadoPorMotor, false);
});

test('README.md y doc/05-plan/guion-demo.md documentan el aviso médico, IA_APAGADA=1 y las 11 rutas', () => {
  const readmePath = join(RAIZ, 'README.md');
  const guionPath = join(RAIZ, 'doc', '05-plan', 'guion-demo.md');

  assert.equal(existsSync(readmePath), true);
  assert.equal(existsSync(guionPath), true);

  const readme = readFileSync(readmePath, 'utf8');
  const guion = readFileSync(guionPath, 'utf8');

  for (const [nombre, contenido] of [['README.md', readme], ['guion-demo.md', guion]]) {
    assert.match(contenido, /no es un dispositivo médico/i, `${nombre} debe incluir el aviso obligatorio`);
    assert.match(contenido, /IA_APAGADA=1/, `${nombre} debe documentar IA_APAGADA=1`);
    for (const ruta of RUTAS) {
      assert.ok(contenido.includes(`\`${ruta.href}\``), `${nombre} debe documentar la ruta ${ruta.href}`);
    }
  }
});
