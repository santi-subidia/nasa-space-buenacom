// Fichas ⓘ de cada indicador del chequeo: qué es, por qué importa en el espacio,
// cómo medirlo y cuándo preocuparse. Rangos: doc/proyecto/sintesis/catalogo-indicadores.md
// (valores generales para adultos sanos; orientativos, no son consejo médico).

export const INFO = {
  presion: {
    titulo: 'Presión arterial',
    que: 'La fuerza con que la sangre empuja las paredes de las arterias. Se mide con dos números: sistólica (cuando el corazón late) y diastólica (entre latidos).',
    espacio: 'En microgravedad los fluidos suben hacia la cabeza y el corazón cambia de forma. Al volver a una gravedad mayor la presión puede caer y causar mareos al pararse.',
    medir: 'Sentado, en reposo 5 minutos, con el manguito a la altura del corazón. Siempre a la misma hora de la mañana.',
    preocuparse: 'Normal: 90–129 / 60–84 mmHg. Atención desde 130/85 o por debajo de 90/60. Avisar si hay mareo o desmayo, o si pasa de 180/120.',
  },
  hr_rest: {
    titulo: 'Frecuencia cardíaca en reposo',
    que: 'Cuántas veces late el corazón por minuto cuando estás tranquilo.',
    espacio: 'Sube con el estrés, la falta de sueño, la deshidratación y las infecciones. Es un buen aviso temprano.',
    medir: 'Lo mide el reloj (Watch) durante el descanso; no se edita a mano.',
    preocuparse: 'Normal: 50–90 lpm (o hasta +10 sobre tu base). Atención si pasa de 100. Avisar si pasa de 120 o es irregular.',
  },
  glucose: {
    titulo: 'Glucosa en sangre',
    que: 'El azúcar que circula en la sangre y alimenta al cuerpo y al cerebro.',
    espacio: 'La dieta del espacio y el estrés pueden cambiarla. Se controla semanal o según el protocolo.',
    medir: 'Con glucómetro, en ayunas (8 horas sin comer).',
    preocuparse: 'Normal en ayunas: 70–99 mg/dL. Atención de 100 a 125. Avisar por debajo de 70 o por encima de 250.',
  },
  temp: {
    titulo: 'Temperatura corporal',
    que: 'La temperatura interna del cuerpo.',
    espacio: 'El sistema inmune cambia en el espacio y virus latentes (como el herpes) pueden reactivarse. La fiebre es una señal temprana.',
    medir: 'Con termómetro, por la mañana y antes de comer o hacer ejercicio.',
    preocuparse: 'Normal: 36,1–37,2 °C. Atención de 37,3 a 37,9. Avisar desde 38,0 °C o por debajo de 35 °C.',
  },
  sleep_h: {
    titulo: 'Horas de sueño',
    que: 'Cuántas horas dormiste anoche.',
    espacio: 'Sin ciclo de día y noche y con ruido y trabajo por turnos, los astronautas duermen menos. Dormir mal baja las defensas y empeora el ánimo.',
    medir: 'Lo registrás al despertar; si hay reloj de sueño, se completa solo.',
    preocuparse: 'Normal: 7–9 h. Atención de 6 a 7. Avisar si dormís menos de 5 h o menos de 6 h tres noches seguidas.',
  },
  spo2: {
    titulo: 'SpO₂ (oxígeno en sangre)',
    que: 'El porcentaje de la sangre que lleva oxígeno.',
    espacio: 'Sirve para detectar hipoxia por fallas del aire de la cabina o exceso de CO₂.',
    medir: 'Lo mide el reloj (Watch); no se edita a mano.',
    preocuparse: 'Normal: 95–100 %. Atención de 90 a 94 %. Avisar por debajo de 90 %.',
  },
  water_ml: {
    titulo: 'Agua',
    que: 'Los mililitros de agua que tomaste hoy.',
    espacio: 'Beber poco favorece los cálculos renales y baja la presión al aterrizar.',
    medir: 'Sumá 250 ml cada vez que tomás un vaso.',
    preocuparse: 'Meta: al menos 2000 ml por día. Menos de 1500 ml varios días seguidos es una señal de atención.',
  },
  stress: {
    titulo: 'Estrés',
    que: 'Cómo de tensa o agotada te sentís, de 1 (nada) a 10 (muchísimo).',
    espacio: 'El estrés sostenido más la falta de sueño debilitan las defensas y reactivan virus latentes.',
    medir: 'Una puntuación personal, sin respuesta correcta.',
    preocuparse: 'Atención desde 7 durante varios días. Avisar si sentís que no podés con la situación.',
  },
  mood: {
    titulo: 'Ánimo',
    que: 'Cómo te sentís hoy, de 1 (muy mal) a 5 (muy bien).',
    espacio: 'El aislamiento y el confinamiento afectan la salud mental de toda la tripulación.',
    medir: 'Elegí la cara que mejor te represente.',
    preocuparse: 'Atención si es 3 o baja. Avisar si es 1–2 durante 3 días, o ante pensamientos de hacerte daño: contacto inmediato.',
  },
};

export const CARAS = [
  { valor: 1, emoji: '😞', texto: 'Muy mal' },
  { valor: 2, emoji: '🙁', texto: 'Mal' },
  { valor: 3, emoji: '😐', texto: 'Normal' },
  { valor: 4, emoji: '🙂', texto: 'Bien' },
  { valor: 5, emoji: '😀', texto: 'Muy bien' },
];
