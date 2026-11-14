'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/components/Card';
import {
  cerrarSesion,
  entrarComoPerfil,
  iniciarSesionConCredenciales,
  PERFILES_DEMO,
  useSesion,
} from '@/lib/auth/sesion';
import { estaSupabaseConfigurado } from '@/lib/supabase/cliente';
import styles from './LoginPantalla.module.scss';

export default function LoginPantalla() {
  const router = useRouter();
  const sesion = useSesion();
  const supabaseOk = estaSupabaseConfigurado();

  const [email, setEmail] = useState(PERFILES_DEMO[2].email);
  const [password, setPassword] = useState(PERFILES_DEMO[2].passwordDemo);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  async function manejarAccesoRapido(perfil) {
    if (cargando) return;
    setCargando(true);
    setError('');
    setMensaje('');
    const res = await entrarComoPerfil(perfil.id);
    setCargando(false);
    if (!res.ok) {
      setError(res.error ?? 'No pudimos iniciar sesión.');
      return;
    }
    setMensaje(`Sesión activa como ${res.sesion.nombre} (${res.modo === 'supabase' ? 'Supabase Auth' : 'Modo local'}).`);
    router.push(perfil.rutaInicial ?? '/');
  }

  async function manejarSubmit(e) {
    e.preventDefault();
    if (cargando) return;
    setCargando(true);
    setError('');
    setMensaje('');
    const res = await iniciarSesionConCredenciales(email, password);
    setCargando(false);
    if (!res.ok) {
      setError(res.error ?? 'Credenciales incorrectas.');
      return;
    }
    setMensaje(`Autenticado en ${res.modo === 'supabase' ? 'Supabase Auth' : 'Modo local'} como ${res.sesion.nombre}.`);
    router.push(res.sesion.rol === 'houston' ? '/houston' : '/');
  }

  async function manejarCerrar() {
    await cerrarSesion();
    setMensaje('Sesión restablecida al perfil predeterminado (Cmdt. Ana Ríos).');
    setError('');
  }

  return (
    <div className={styles.pantalla}>
      <header className={styles.encabezado}>
        <div>
          <h1>Acceso y Roles de Misión</h1>
          <p className={styles.sub}>
            Alterná entre la tripulación en Base Marte (Ares IV) y la Médica de Vuelo en Tierra (Houston JSC)
          </p>
        </div>
        <span className={`${styles.estadoPill} ${supabaseOk ? styles.estadoOk : ''}`}>
          {supabaseOk ? '● Supabase PostgreSQL + Auth conectado' : '○ Modo local sin conexión'}
        </span>
      </header>

      <Card titulo="Sesión activa actual" className={styles.sesionCard}>
        <div className={styles.sesionActual}>
          <div>
            <p className={styles.rolBadge}>{sesion.entorno}</p>
            <h2 className={styles.nombreActual}>{sesion.nombre}</h2>
            <p className={styles.metaActual}>{sesion.titulo} · {sesion.email}</p>
          </div>
          <div className={styles.sesionAcciones}>
            {sesion.rol === 'houston' && (
              <button
                type="button"
                className={styles.botonAcento}
                onClick={() => router.push('/houston')}
              >
                Ir a Consola Houston →
              </button>
            )}
            <button type="button" className={styles.boton} onClick={manejarCerrar}>
              ↺ Restablecer rol base
            </button>
          </div>
        </div>
      </Card>

      <section aria-label="Perfiles de misión">
        <h2 className={styles.seccionTitulo}>Acceso rápido por rol (autenticación real en Supabase Auth)</h2>
        <div className={styles.perfilesGrid}>
          {PERFILES_DEMO.map((perfil) => {
            const activo = sesion.id === perfil.id;
            const esHouston = perfil.rol === 'houston';
            return (
              <Card
                key={perfil.id}
                titulo={perfil.entorno}
                acento={esHouston ? 'orange' : activo ? 'ia' : undefined}
                className={`${styles.perfilCard} ${activo ? styles.perfilActivo : ''}`}
              >
                <h3 className={styles.perfilNombre}>{perfil.nombre}</h3>
                <p className={styles.perfilRol}>{perfil.titulo}</p>
                <p className={styles.perfilDesc}>{perfil.descripcion}</p>
                <p className={styles.credenciales}>
                  <code>{perfil.email}</code> · clave: <code>{perfil.passwordDemo}</code>
                </p>
                <button
                  type="button"
                  className={esHouston ? styles.botonHouston : styles.botonAcento}
                  disabled={cargando}
                  onClick={() => manejarAccesoRapido(perfil)}
                >
                  {activo ? `✓ Entrar como ${perfil.nombre.split(' ')[0]}` : `Entrar como ${perfil.nombre}`}
                </button>
              </Card>
            );
          })}
        </div>
      </section>

      <Card titulo="Ingreso manual con correo y contraseña (Supabase Auth)">
        <form className={styles.formulario} onSubmit={manejarSubmit}>
          <label className={styles.campo}>
            <span>Correo institucional</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="elena.vance@houston.nasa.gov"
              required
            />
          </label>
          <label className={styles.campo}>
            <span>Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button type="submit" className={styles.botonAcento} disabled={cargando}>
            {cargando ? 'Autenticando…' : 'Iniciar sesión en Supabase'}
          </button>
        </form>
        {mensaje && <p className={styles.feedbackOk} role="status">{mensaje}</p>}
        {error && <p className={styles.feedbackError} role="alert">{error}</p>}
      </Card>
    </div>
  );
}
