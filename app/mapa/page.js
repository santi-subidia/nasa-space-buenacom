import { redirect } from 'next/navigation';
import { esZonaValida, rutaZona } from '@/lib/content/rutaZona';

// El mapa corporal ahora vive dentro de Salud (Física, Mental y Riesgos). Se conserva la ruta para enlaces viejos.
export default async function Mapa({ searchParams }) {
  const { zona } = await searchParams;
  redirect(esZonaValida(zona) ? rutaZona(zona) : '/salud/fisica#mapa');
}
