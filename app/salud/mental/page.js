import SaludPantalla from '@/components/salud/SaludPantalla';

export const metadata = { title: 'Salud Mental · VYTA' };

export default async function Mental({ searchParams }) {
  const { zona } = await searchParams;
  return <SaludPantalla seccion="mental" zona={typeof zona === 'string' ? zona : null} />;
}
