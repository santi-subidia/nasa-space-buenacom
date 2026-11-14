import { Suspense } from 'react';
import MapaCorporal from '@/components/mapa/MapaCorporal';

export const metadata = { title: 'Mapa corporal · AstroVitals' };

export default function Mapa() {
  // useSearchParams (la zona que pide la URL) necesita Suspense en el build estático.
  return (
    <Suspense>
      <MapaCorporal />
    </Suspense>
  );
}
