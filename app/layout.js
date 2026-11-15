import { Inter } from 'next/font/google';
import Sidebar from '@/components/Sidebar';
import ConsolaDev from '@/components/ConsolaDev';
import CentroNotificaciones from '@/components/notificaciones/CentroNotificaciones';
import '@/styles/globals.scss';
import styles from './layout.module.scss';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata = {
  title: 'VYTA',
  description: 'Compañero de salud para astronautas en misiones largas. Prototipo educativo; no es un dispositivo médico.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={inter.variable}>
      <body>
        <div className={styles.app}>
          <Sidebar />
          <main className={styles.contenido}>{children}</main>
        </div>
        <CentroNotificaciones />
        <ConsolaDev />
      </body>
    </html>
  );
}
