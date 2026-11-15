import SaludPantalla from '@/components/salud/SaludPantalla';

export const metadata = { title: 'Riesgos · VYTA' };

export default async function Riesgos({ searchParams }) {
  const { zona } = await searchParams;
  return <SaludPantalla seccion="riesgos" zona={typeof zona === 'string' ? zona : null} />;
}
