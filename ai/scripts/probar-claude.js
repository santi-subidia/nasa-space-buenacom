// Prueba real contra la API (gasta centavos). Uso, desde ai/:
//     npm run probar            -> llama a Claude dos veces y muestra el uso del caché
//     npm run probar:sin-clave  -> sin clave: tiene que salir la respuesta guardada, sin romper
//
// La clave se lee de ai/.env (ANTHROPIC_API_KEY=...). Este script nunca la imprime.
import { consultarClaude } from '../claude.js';
import { construirTarea } from '../tareas.js';

const peticion = construirTarea({
  tipo: 'answer',
  pregunta: 'Why did I get a cold sore?',
  riesgos: ['inmunidad', 'sueno-horarios'],
  datosDelDia: { sol: 42, sueno_horas: 5.3, estres: 8, temperatura_c: 37.2 },
});
const { citas, ...paraClaude } = peticion;

console.log('Configured key:', process.env.ANTHROPIC_API_KEY ? 'yes' : 'NO (saved response will be used)');

for (const vuelta of [1, 2]) {
  const t0 = Date.now();
  const r = await consultarClaude(paraClaude);
  console.log(`\n--- Query ${vuelta} (${Date.now() - t0} ms) ---`);
  console.log('ok:', r.ok, '· source:', r.origen, '· reason:', r.motivo);
  if (r.texto) console.log('Response:', r.texto);
  if (r.uso) console.log('Usage:', r.uso, vuelta === 2 && r.uso.cacheLectura > 0 ? '<- cache works' : '');
}
console.log('\nAvailable citations:', citas.map((c) => `${c.id}: ${c.titulo}`).join(' | '));
