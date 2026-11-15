'use client';

import { useEffect, useRef } from 'react';
import styles from './InicioPantalla.module.scss';

const TAU = Math.PI * 2;
const PUNTOS = 64;

function colorPorFase(fase) {
  if (fase === 'escuchando') return { r: 32, g: 213, b: 246, sec: [132, 118, 255] };
  if (fase === 'hablando') return { r: 191, g: 148, b: 255, sec: [52, 232, 255] };
  if (fase === 'pensando' || fase === 'transcribiendo' || fase === 'solicitando') {
    return { r: 160, g: 120, b: 255, sec: [96, 175, 255] };
  }
  return { r: 142, g: 106, b: 245, sec: [48, 175, 235] };
}

function trazarContornoViscoso(ctx, cx, cy, radioBase, amplitud, tiempo, semilla = 0) {
  const pts = [];
  for (let i = 0; i < PUNTOS; i++) {
    const ang = (i / PUNTOS) * TAU;
    const onda1 = Math.sin(ang * 3 + tiempo * 2.1 + semilla);
    const onda2 = Math.sin(ang * 5 - tiempo * 1.6 + semilla * 1.7) * 0.55;
    const onda3 = Math.cos(ang * 2 + tiempo * 3.1 + semilla * 0.5) * 0.45;
    const deformacion = (onda1 + onda2 + onda3) * amplitud;
    const r = radioBase + deformacion;
    pts.push({ x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r });
  }
  ctx.beginPath();
  for (let i = 0; i < PUNTOS; i++) {
    const p0 = pts[i];
    const p1 = pts[(i + 1) % PUNTOS];
    const mx = (p0.x + p1.x) / 2;
    const my = (p0.y + p1.y) / 2;
    if (i === 0) ctx.moveTo((pts[PUNTOS - 1].x + p0.x) / 2, (pts[PUNTOS - 1].y + p0.y) / 2);
    ctx.quadraticCurveTo(p0.x, p0.y, mx, my);
  }
  ctx.closePath();
}

export default function EsferaViscosa({ fase = 'inactivo', nivelRef, compacta = false, className = '' }) {
  const canvasRef = useRef(null);
  const faseRef = useRef(fase);
  faseRef.current = fase;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const tamano = compacta ? 124 : 230;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = tamano * dpr;
    canvas.height = tamano * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let energiaSuave = 0.04;
    let nivelSuave = 0;
    const inicio = performance.now();

    function dibujar(ahora) {
      const t = (ahora - inicio) / 1000;
      const actual = faseRef.current;
      const nivelCrudo = Math.min(1, Math.max(0, nivelRef?.current ?? 0));
      nivelSuave += (nivelCrudo - nivelSuave) * 0.24;

      let objetivo = 0.04;
      if (actual === 'solicitando' || actual === 'transcribiendo' || actual === 'pensando') {
        objetivo = 0.24;
      } else if (actual === 'escuchando') {
        objetivo = 0.14 + nivelSuave * 0.86;
      } else if (actual === 'hablando') {
        const cadencia = 0.22 + 0.14 * Math.sin(t * 6.5) + 0.09 * Math.sin(t * 11.3);
        objetivo = Math.max(cadencia, 0.22 + nivelSuave * 0.95);
      }
      energiaSuave += (objetivo - energiaSuave) * 0.16;

      const cx = tamano / 2;
      const cy = tamano / 2;
      const radio = tamano * 0.35;
      const pal = colorPorFase(actual);

      ctx.clearRect(0, 0, tamano, tamano);

      // Halo exterior luminoso
      const halo = ctx.createRadialGradient(cx, cy, radio * 0.55, cx, cy, radio * (1.35 + energiaSuave * 0.25));
      halo.addColorStop(0, `rgba(${pal.r}, ${pal.g}, ${pal.b}, ${0.28 + energiaSuave * 0.34})`);
      halo.addColorStop(0.65, `rgba(${pal.sec[0]}, ${pal.sec[1]}, ${pal.sec[2]}, ${0.1 + energiaSuave * 0.15})`);
      halo.addColorStop(1, 'rgba(10, 16, 40, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, radio * 1.65, 0, TAU);
      ctx.fill();

      // Capa externa viscosa (membrana semitransparente)
      const ampExterna = radio * (0.02 + energiaSuave * 0.09);
      trazarContornoViscoso(ctx, cx, cy, radio * (1.03 + energiaSuave * 0.04), ampExterna, t * (0.9 + energiaSuave * 1.4), 0.7);
      ctx.fillStyle = `rgba(${pal.sec[0]}, ${pal.sec[1]}, ${pal.sec[2]}, ${0.18 + energiaSuave * 0.2})`;
      ctx.fill();

      // Cuerpo principal líquido
      const ampPrincipal = radio * (0.015 + energiaSuave * 0.075);
      trazarContornoViscoso(ctx, cx, cy, radio, ampPrincipal, t * (1.1 + energiaSuave * 1.6), 0);
      ctx.save();
      ctx.clip();

      const fondo = ctx.createRadialGradient(cx - radio * 0.25, cy - radio * 0.28, radio * 0.1, cx, cy, radio * 1.15);
      fondo.addColorStop(0, `rgba(218, 198, 255, ${0.88 + energiaSuave * 0.12})`);
      fondo.addColorStop(0.35, `rgba(${pal.r}, ${pal.g}, ${pal.b}, 0.92)`);
      fondo.addColorStop(0.75, 'rgba(66, 43, 148, 0.95)');
      fondo.addColorStop(1, 'rgba(18, 26, 66, 0.98)');
      ctx.fillStyle = fondo;
      ctx.fillRect(0, 0, tamano, tamano);

      // Lóbulos internos tipo plasma/viscosidad
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 3; i++) {
        const ang = t * (0.9 + i * 0.35) + i * 2.1;
        const dist = radio * (0.22 + energiaSuave * 0.18);
        const lx = cx + Math.cos(ang) * dist;
        const ly = cy + Math.sin(ang * 1.2) * dist;
        const lr = radio * (0.58 + 0.16 * Math.sin(t * 2 + i));
        const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
        const c = i === 1 ? pal.sec : [pal.r, pal.g, pal.b];
        g.addColorStop(0, `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${0.32 + energiaSuave * 0.32})`);
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(lx, ly, lr, 0, TAU);
        ctx.fill();
      }

      // Brillo especular superior suave
      const brillo = ctx.createRadialGradient(cx - radio * 0.3, cy - radio * 0.34, 0, cx - radio * 0.25, cy - radio * 0.25, radio * 0.52);
      brillo.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
      brillo.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = brillo;
      ctx.beginPath();
      ctx.arc(cx - radio * 0.25, cy - radio * 0.25, radio * 0.52, 0, TAU);
      ctx.fill();

      ctx.restore();

      // Borde sutil luminoso
      trazarContornoViscoso(ctx, cx, cy, radio, ampPrincipal, t * (1.1 + energiaSuave * 1.6), 0);
      ctx.strokeStyle = `rgba(220, 200, 255, ${0.32 + energiaSuave * 0.45})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (!reducido) raf = requestAnimationFrame(dibujar);
    }

    raf = requestAnimationFrame(dibujar);
    return () => cancelAnimationFrame(raf);
  }, [compacta, nivelRef]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`${styles.esferaCanvas} ${compacta ? styles.esferaCanvasCompacta : ''} ${className}`}
    />
  );
}
