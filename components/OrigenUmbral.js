import { ORIGEN_UMBRAL } from '@/lib/tipos';

/**
 * Muestra de dónde sale el número del umbral que disparó una alerta
 * (cifra NASA, derivada de la NASA, guía externa o criterio de diseño).
 * @param {{ basis?: import('@/lib/tipos').ThresholdBasis | null, className?: string }} props
 */
export default function OrigenUmbral({ basis, className }) {
  if (!basis?.type) return null;
  const etiqueta = ORIGEN_UMBRAL[basis.type] || basis.type;
  return (
    <p className={className} data-origen={basis.type}>
      Umbral: <strong>{etiqueta}</strong>
      {basis.ref && (
        <>
          {' · '}
          {basis.url ? <a href={basis.url} target="_blank" rel="noopener noreferrer">{basis.ref}</a> : basis.ref}
        </>
      )}
      {basis.note && <><br />{basis.note}</>}
    </p>
  );
}
