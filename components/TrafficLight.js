import { NIVELES } from '@/lib/niveles';
import styles from './TrafficLight.module.scss';

// El semáforo nunca depende solo del color: cada nivel tiene su forma y su texto.
export default function TrafficLight({ nivel = 'green', conTexto = true }) {
  const { etiqueta, forma } = NIVELES[nivel] ?? NIVELES.green;
  return (
    <span className={`${styles.semaforo} ${styles[nivel]}`}>
      <span className={`${styles.forma} ${styles[forma]}`} aria-hidden="true" />
      {conTexto ? etiqueta : <span className={styles.oculto}>{etiqueta}</span>}
    </span>
  );
}
