import { useEffect, useRef } from "react";

type No = { x: number; y: number; vx: number; vy: number; r: number; neon: boolean };

/**
 * Fundo das telas de entrada (prova e instrutor): aurora suave, uma rede de pontos ligados que reage ao cursor
 * (cada ponto é um "dado").
 */
export default function Fundo() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduz = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let nos: No[] = [];
    let w = 0, h = 0, raf = 0;
    let verde = [52, 214, 160];
    const rosa = [255, 77, 141];
    const mouse = { x: -9999, y: -9999 };

    const iniciar = () => {
      w = window.innerWidth; h = window.innerHeight;
      c.width = w * dpr; c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.min(80, Math.round((w * h) / 20000));
      nos = Array.from({ length: n }, (_, i) => ({
        x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.38, vy: (Math.random() - 0.5) * 0.38,
        r: 1 + Math.random() * 1.9, neon: i % 6 === 0,
      }));
    };
    const lerCor = () => {
      const m = getComputedStyle(c).color.match(/\d+/g);
      if (m) verde = [Number(m[0]), Number(m[1]), Number(m[2])];
    };
    const rgba = (cor: number[], a: number) => `rgba(${cor[0]},${cor[1]},${cor[2]},${a})`;

    const quadro = () => {
      ctx.clearRect(0, 0, w, h);
      const alcance = 150, alcanceMouse = 210;
      if (!reduz) for (const n of nos) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      }
      ctx.lineWidth = 0.8;
      for (let i = 0; i < nos.length; i++) {
        const a = nos[i]!;
        for (let j = i + 1; j < nos.length; j++) {
          const b = nos[j]!;
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < alcance) {
            ctx.strokeStyle = rgba(a.neon || b.neon ? rosa : verde, (1 - d / alcance) * 0.32);
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        const dm = Math.hypot(a.x - mouse.x, a.y - mouse.y);
        if (dm < alcanceMouse) {
          ctx.strokeStyle = rgba(a.neon ? rosa : verde, (1 - dm / alcanceMouse) * 0.7);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
      }
      for (const n of nos) {
        ctx.fillStyle = rgba(n.neon ? rosa : verde, n.neon ? 0.9 : 0.65);
        ctx.shadowColor = rgba(n.neon ? rosa : verde, 0.9);
        ctx.shadowBlur = n.neon ? 10 : 6;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.shadowBlur = 0;
    };
    const loop = () => { quadro(); raf = requestAnimationFrame(loop); };

    iniciar(); lerCor();
    if (reduz) quadro(); else loop();

    const aoRedimensionar = () => { iniciar(); if (reduz) quadro(); };
    const aoMover = (e: PointerEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    const aoSair = () => { mouse.x = -9999; mouse.y = -9999; };
    const aoMudarVisibilidade = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduz) loop();
    };
    const timer = window.setInterval(lerCor, 2000);
    window.addEventListener("resize", aoRedimensionar);
    window.addEventListener("pointermove", aoMover);
    document.addEventListener("pointerleave", aoSair);
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(timer);
      window.removeEventListener("resize", aoRedimensionar);
      window.removeEventListener("pointermove", aoMover);
      document.removeEventListener("pointerleave", aoSair);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
    };
  }, []);

  return (
    <>
      <div className="aurora" aria-hidden="true"><i /><i /><i /></div>
      <canvas ref={ref} className="rede-dados" aria-hidden="true" />
    </>
  );
}
