import styles from './PantallaVacia.module.scss';

// Marcador de posición de cada pantalla hasta que se implemente su issue.
export default function PantallaVacia({ titulo, descripcion, issue, children }) {
  return (
    <section className={styles.pantalla}>
      <header>
        <h1 className={styles.titulo}>{titulo}</h1>
        <p className={styles.descripcion}>{descripcion}</p>
      </header>
      <div className={styles.vacio}>
        <span>Pantalla vacía</span>
        {issue && <span className={styles.issue}>{issue}</span>}
        {children}
      </div>
    </section>
  );
}
