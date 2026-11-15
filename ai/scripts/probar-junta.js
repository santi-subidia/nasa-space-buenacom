// Prueba real de la junta médica con los datos del sol 42 (gasta ~US$ 0,003). Uso, desde ai/:
//     npm run probar:junta
// Lee la clave de ai/.env (ANTHROPIC_API_KEY). Nunca la imprime.
import { consultarClaude } from '../claude.js';
import { ENTRADA_SOL42 } from '../junta/ejemplo-sol42.js';
import { mergeLevel } from '../junta/niveles.js';
import { construirTarea } from '../tareas.js';

const { citas, procesar, ...peticion } = construirTarea({ tipo: 'board', ...ENTRADA_SOL42 });
console.log('Clave configurada:', process.env.ANTHROPIC_API_KEY ? 'sí' : 'NO (se usará la junta guardada)');

const t0 = Date.now();
const r = await consultarClaude(peticion);
console.log(`\n(${Date.now() - t0} ms) ok: ${r.ok} · origen: ${r.origen} · motivo: ${r.motivo}`);
if (r.uso) console.log('Uso:', r.uso);
if (!r.json) process.exit(r.ok ? 0 : 1);

const { junta, nivelFinal, accionFinal } = { junta: r.json, ...procesar(r) };
console.log(`\nNivel del motor: ${ENTRADA_SOL42.nivelMotor} · junta: ${r.json.sintesis.nivel} · FINAL: ${nivelFinal ?? mergeLevel(ENTRADA_SOL42.nivelMotor, r.json.sintesis.nivel)} · acción: ${accionFinal}`);
for (const e of r.json.especialistas) console.log(`  [${e.nivel.padEnd(6)}] ${e.id}: ${e.opinion}  (${e.fuentes.join(', ')})`);
console.log('\nDesacuerdos:', r.json.desacuerdos.length);
for (const d of r.json.desacuerdos) console.log(`  · ${d.tema} → ${d.resolucion}`);
console.log('\nDecisión:', r.json.sintesis.decision);
console.log('\nPara Nicolás:', r.json.informe_astronauta.resumen);
console.log('\nPara médicos de vuelo:', r.json.informe_tecnico.resumen_clinico);
console.log('\nFuentes disponibles:', citas.map((c) => c.id).join(' '));
