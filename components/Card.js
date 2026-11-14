import styles from './Card.module.scss';

// Panel base (superficie con borde). `acento` pinta un borde lateral: 'ia' para Vega o un nivel del semáforo.
export default function Card({ children, titulo, acento, className = '', ...props }) {
  return (
    <section
      className={[styles.card, acento && styles[acento], className].filter(Boolean).join(' ')}
      {...props}
    >
      {titulo && <h2 className={styles.titulo}>{titulo}</h2>}
      {children}
    </section>
  );
}
