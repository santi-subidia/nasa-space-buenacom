// Fichas ⓘ de cada indicador del chequeo: qué es, por qué importa en el espacio,
// cómo medirlo y cuándo preocuparse. Rangos: doc/proyecto/sintesis/catalogo-indicadores.md
// (valores generales para adultos sanos; orientativos, no son consejo médico).

export const INFO = {
  presion: {
    titulo: 'Blood pressure',
    que: 'The force of blood pushing against artery walls. Measured with two numbers: systolic (when the heart beats) and diastolic (between beats).',
    espacio: 'In microgravity, fluids shift upward toward the head and the heart reshapes. Returning to higher gravity can cause blood pressure to drop and trigger dizziness when standing.',
    medir: 'Seated, resting for 5 minutes, with the cuff at heart level. Always at the same time in the morning.',
    preocuparse: 'Normal: 90–129 / 60–84 mmHg. Watch from 130/85 or below 90/60. Report if there is dizziness or fainting, or if above 180/120.',
  },
  hr_rest: {
    titulo: 'Resting heart rate',
    que: 'How many times the heart beats per minute while you are calm.',
    espacio: 'Rises with stress, poor sleep, dehydration, and infection. It is a reliable early warning signal.',
    medir: 'At rest after 5 calm minutes. You can enter it manually or estimate it contact-free with the camera in "How do I look today?" (rPPG).',
    preocuparse: 'Normal: 50–90 bpm (or up to +10 above your baseline). Watch if above 100. Report if above 120 or irregular.',
  },
  glucose: {
    titulo: 'Blood glucose',
    que: 'The sugar circulating in your blood that fuels your body and brain.',
    espacio: 'Space diet and stress can alter it. Checked weekly or per protocol.',
    medir: 'With a glucometer, fasting (8 hours without eating).',
    preocuparse: 'Normal fasting: 70–99 mg/dL. Watch from 100 to 125. Report below 70 or above 250.',
  },
  temp: {
    titulo: 'Body temperature',
    que: 'Internal body temperature.',
    espacio: 'The immune system changes in space and latent viruses (such as herpes) can reactivate. Fever is an early warning sign.',
    medir: 'With a thermometer, in the morning before eating or exercising.',
    preocuparse: 'Normal: 36.1–37.2 °C. Watch from 37.3 to 37.9. Report from 38.0 °C or below 35 °C.',
  },
  sleep_h: {
    titulo: 'Sleep hours',
    que: 'How many hours you slept last night.',
    espacio: 'Without a natural day-night cycle, plus noise and shift work, astronauts sleep less. Poor sleep weakens immunity and lowers mood.',
    medir: 'Log it when waking up.',
    preocuparse: 'Normal: 7–9 h. Watch from 6 to 7. Report if sleeping under 5 h or under 6 h for three nights in a row.',
  },
  spo2: {
    titulo: 'SpO₂ (blood oxygen)',
    que: 'The percentage of blood carrying oxygen.',
    espacio: 'Used to detect hypoxia from cabin air failures or excess CO₂.',
    medir: 'With a finger pulse oximeter, at rest.',
    preocuparse: 'Normal: 95–100%. Watch from 90 to 94%. Report below 90%.',
  },
  water_ml: {
    titulo: 'Water',
    que: 'Milliliters of water you drank today.',
    espacio: 'Low fluid intake promotes kidney stones and drops blood pressure upon landing.',
    medir: 'Add 250 ml each time you drink a glass.',
    preocuparse: 'Goal: at least 2000 ml per day. Under 1500 ml for several consecutive days is a watch signal.',
  },
  stress: {
    titulo: 'Stress',
    que: 'How tense or drained you feel, from 1 (none) to 10 (extreme).',
    espacio: 'Sustained stress combined with lack of sleep weakens immunity and can reactivate latent viruses.',
    medir: 'A personal rating, with no right or wrong answer.',
    preocuparse: 'Watch from 7 across several days. Report if you feel overwhelmed.',
  },
  mood: {
    titulo: 'Mood',
    que: 'How you feel today, from 1 (very bad) to 5 (very good).',
    espacio: 'Isolation and confinement affect mental health across the entire crew.',
    medir: 'Choose the face that best represents how you feel.',
    preocuparse: 'Watch if 3 or dropping. Report if 1–2 for 3 days, or immediately upon any self-harm thoughts.',
  },
};

export const CARAS = [
  { valor: 1, emoji: '😞', texto: 'Very bad' },
  { valor: 2, emoji: '🙁', texto: 'Bad' },
  { valor: 3, emoji: '😐', texto: 'Okay' },
  { valor: 4, emoji: '🙂', texto: 'Good' },
  { valor: 5, emoji: '😀', texto: 'Very good' },
];
