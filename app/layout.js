import { Inter } from 'next/font/google';
import Sidebar from '@/components/Sidebar';
import ConsolaDev from '@/components/ConsolaDev';
import CentroNotificaciones from '@/components/notificaciones/CentroNotificaciones';
import '@/styles/globals.scss';
import styles from './layout.module.scss';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata = {
  title: 'VYTA',
  description: 'Health companion for astronauts on long-duration missions. Educational prototype; not a medical device.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
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
