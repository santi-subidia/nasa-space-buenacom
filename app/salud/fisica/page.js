import SaludPantalla from '@/components/salud/SaludPantalla';

export const metadata = { title: 'Salud Física · VYTA' };

export default async function Fisica({ searchParams }) {
  const { zona } = await searchParams;
  return <SaludPantalla seccion="fisica" zona={typeof zona === 'string' ? zona : null} />;
}
