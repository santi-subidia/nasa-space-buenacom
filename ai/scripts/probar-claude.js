// Prueba real contra la API (gasta centavos). Uso, desde ai/:
//     npm run probar            -> llama a Claude dos veces y muestra el uso del caché
//     npm run probar:sin-clave  -> sin clave: tiene que salir la respuesta guardada, sin romper
//
// La clave se lee de ai/.env (ANTHROPIC_API_KEY=...). Este script nunca la imprime.
import { consultarClaude } from '../claude.js';
import { construirTarea } from '../tareas.js';

const peticion = construirTarea({
  tipo: 'answer',
  pregunta: '¿Por qué me salió herpes labial?',
  riesgos: ['inmunidad', 'sueno-horarios'],
  datosDelDia: { sol: 42, sueno_horas: 5.3, estres: 8, temperatura_c: 37.2 },
});
const { citas, ...paraClaude } = peticion;

console.log('Clave configurada:', process.env.ANTHROPIC_API_KEY ? 'sí' : 'NO (se usará la respuesta guardada)');

for (const vuelta of [1, 2]) {
  const t0 = Date.now();
  const r = await consultarClaude(paraClaude);
  console.log(`\n--- Consulta ${vuelta} (${Date.now() - t0} ms) ---`);
  console.log('ok:', r.ok, '· origen:', r.origen, '· motivo:', r.motivo);
  if (r.texto) console.log('Respuesta:', r.texto);
  if (r.uso) console.log('Uso:', r.uso, vuelta === 2 && r.uso.cacheLectura > 0 ? '← el caché funciona' : '');
}
console.log('\nCitas disponibles:', citas.map((c) => `${c.id}: ${c.titulo}`).join(' | '));
