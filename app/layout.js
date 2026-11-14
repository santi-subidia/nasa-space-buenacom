import { Inter, Space_Grotesk } from 'next/font/google';
import Sidebar from '@/components/Sidebar';
import ConsolaDev from '@/components/ConsolaDev';
import CentroNotificaciones from '@/components/notificaciones/CentroNotificaciones';
import '@/styles/globals.scss';
import styles from './layout.module.scss';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

export const metadata = {
  title: 'AstroVitals',
  description: 'Compañero de salud para astronautas en misiones largas. Prototipo educativo; no es un dispositivo médico.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${inter.variable} ${spaceGrotesk.variable}`}>
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
