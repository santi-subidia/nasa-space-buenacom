import VegaPantalla from '@/components/vega/VegaPantalla';

export const metadata = { title: 'Hablar con Vega · AstroVitals' };

// /vega?modo=chequeo abre directamente el chequeo matutino por voz (el enlace "Completar por voz" de Registrar).
export default async function Vega({ searchParams }) {
  const { modo } = await searchParams;
  return <VegaPantalla modoInicial={modo === 'chequeo' ? 'chequeo' : 'conversar'} />;
}
