import { Suspense } from 'react';
import CausasPantalla from '@/components/causas/CausasPantalla';

export const metadata = { title: '¿Por qué? · AstroVitals' };

export default function Causas() {
  // useSearchParams (qué alerta explicar) necesita Suspense en el build estático.
  return (
    <Suspense>
      <CausasPantalla />
    </Suspense>
  );
}
