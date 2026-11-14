import PantallaVacia from '@/components/PantallaVacia';
import TrafficLight from '@/components/TrafficLight';

export const metadata = { title: 'Inicio · AstroVitals' };

export default function Inicio() {
  return (
    <PantallaVacia
      titulo="Inicio"
      descripcion="Semáforo general, alerta activa, chequeo del día, indicadores y barra de Vega."
    >
      <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
        <TrafficLight nivel="green" />
        <TrafficLight nivel="yellow" />
        <TrafficLight nivel="orange" />
        <TrafficLight nivel="red" />
      </div>
    </PantallaVacia>
  );
}
