import { useCallback, useEffect, useRef, useState } from "react";
import type { Evidencia } from "@ebc/shared";
import { apiInstrutor as api } from "../lib/api";
import { Check, Fechar } from "./Icones";

type Gps = { lat: number; lon: number; acc: number };
type Captura = { blob: Blob; url: string; hora: Date; gps?: Gps };
type Props = {
  instrutor: string;
  colaborador?: string;
  onConcluir: (e: Evidencia) => void;
  onFechar: () => void;
};

const FUSO = "America/Sao_Paulo";
const formatarHora = (d: Date) =>
  d.toLocaleString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
    .replace(", ", "  ");

/** Desenha a foto e queima o carimbo (hora da rede + localização) na própria imagem. */
function carimbar(origem: CanvasImageSource, w: number, h: number, hora: Date, gps: Gps | undefined, linhaExtra: string): Promise<Blob> {
  const escala = Math.min(1, 1600 / w);
  const cw = Math.round(w * escala), ch = Math.round(h * escala);
  const cv = document.createElement("canvas");
  cv.width = cw; cv.height = ch;
  const ctx = cv.getContext("2d")!;
  ctx.drawImage(origem, 0, 0, cw, ch);

  const fs = Math.max(14, Math.round(cw * 0.024));
  const linhas = [
    `${formatarHora(hora)}  ·  hora da rede (GMT-3)`,
    gps ? `Lat ${gps.lat.toFixed(6)}   Lon ${gps.lon.toFixed(6)}   ±${Math.round(gps.acc)} m` : "Localização indisponível",
    linhaExtra,
  ].filter(Boolean);
  const pad = Math.round(fs * 0.7), alt = Math.round(fs * 1.4);
  const faixa = pad * 2 + alt * linhas.length;
  ctx.fillStyle = "rgba(0,0,0,0.62)";
  ctx.fillRect(0, ch - faixa, cw, faixa);
  ctx.fillStyle = "#34d6a0";
  ctx.fillRect(0, ch - faixa, Math.max(4, fs * 0.25), faixa);
  ctx.textBaseline = "middle";
  linhas.forEach((t, i) => {
    ctx.font = `${i === 0 ? "700" : "500"} ${fs}px system-ui, "Segoe UI", sans-serif`;
    ctx.fillStyle = i === 0 ? "#ffffff" : "#e6f2ee";
    ctx.fillText(t, pad + fs * 0.35, ch - faixa + pad + alt * i + alt / 2, cw - pad * 2);
  });
  return new Promise((ok, erro) => cv.toBlob((b) => (b ? ok(b) : erro(new Error("Falha ao gerar a imagem"))), "image/jpeg", 0.86));
}

/** Câmera com carimbo: data/hora vêm do servidor (rede), a localização vem do GPS do aparelho. Imagem sem espelhamento. */
export default function CameraEvidencia({ instrutor, colaborador, onConcluir, onFechar }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const gpsRef = useRef<Gps>();
  const [gps, setGps] = useState<Gps>();
  const [gpsErro, setGpsErro] = useState<string>();
  const [semCamera, setSemCamera] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [captura, setCaptura] = useState<Captura>();
  const [erro, setErro] = useState<string>();

  const extra = [colaborador && `Colaborador: ${colaborador}`, `Instrutor: ${instrutor}`].filter(Boolean).join("  ·  ");

  // Trava a rolagem da página e fecha com Esc
  useEffect(() => {
    const ant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", tecla);
    return () => { document.body.style.overflow = ant; window.removeEventListener("keydown", tecla); };
  }, [onFechar]);

  // GPS (alta precisão, atualizando continuamente)
  useEffect(() => {
    if (!navigator.geolocation) { setGpsErro("Este aparelho não oferece localização."); return; }
    const id = navigator.geolocation.watchPosition(
      (p) => { const g = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy }; gpsRef.current = g; setGps(g); setGpsErro(undefined); },
      (e) => setGpsErro(e.code === 1 ? "Localização bloqueada. Permita o acesso ao GPS no navegador." : "Não foi possível obter a localização."),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Câmera ao vivo (traseira quando existir; no computador usa a webcam)
  useEffect(() => {
    if (captura) return;
    if (!navigator.mediaDevices?.getUserMedia) { setSemCamera(true); return; }
    let stream: MediaStream | undefined;
    let cancelado = false;
    setPronto(false);
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((s) => {
        if (cancelado) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        const v = videoRef.current;
        if (v) { v.srcObject = s; void v.play().then(() => setPronto(true)); }
      })
      .catch(() => setSemCamera(true));
    return () => { cancelado = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, [captura]);

  useEffect(() => () => { if (captura) URL.revokeObjectURL(captura.url); }, [captura]);

  const processar = useCallback(async (origem: CanvasImageSource, w: number, h: number) => {
    // 1) congela o quadro; 2) pede a hora à rede; 3) carimba
    const quadro = document.createElement("canvas");
    quadro.width = w; quadro.height = h;
    quadro.getContext("2d")!.drawImage(origem, 0, 0, w, h);
    const hora = await api.horaDaRede();
    const g = gpsRef.current;
    const blob = await carimbar(quadro, w, h, hora, g, extra);
    setCaptura({ blob, url: URL.createObjectURL(blob), hora, gps: g });
  }, [extra]);

  async function tirarFoto() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    setErro(undefined); setOcupado(true);
    try { await processar(v, v.videoWidth, v.videoHeight); }
    catch (e) { setErro(`Não foi possível obter a hora da rede: ${(e as Error).message}`); }
    finally { setOcupado(false); }
  }

  /** Alternativa só quando a câmera ao vivo não está disponível (ex.: página sem HTTPS no celular). */
  async function aoEscolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setErro(undefined); setOcupado(true);
    try { const bmp = await createImageBitmap(f); await processar(bmp, bmp.width, bmp.height); }
    catch (err) { setErro(`Não foi possível processar a foto: ${(err as Error).message}`); }
    finally { setOcupado(false); }
  }

  async function usar() {
    if (!captura) return;
    setErro(undefined); setOcupado(true);
    try {
      const ev = await api.enviarEvidencia(captura.blob, { lat: captura.gps?.lat, lon: captura.gps?.lon, precisao: captura.gps?.acc, capturadaEm: captura.hora });
      onConcluir(ev);
    } catch (e) { setErro((e as Error).message); setOcupado(false); }
  }

  const precisao = gps ? `±${Math.round(gps.acc)} m` : undefined;

  return (
    <div className="af fixed inset-0 z-50 grid place-items-center p-0 sm:p-6" style={{ background: "rgba(0,0,0,.72)", backdropFilter: "blur(6px)" }} role="dialog" aria-modal="true" aria-label="Câmera de evidência">
      <div className="as flex h-full w-full max-w-3xl flex-col overflow-hidden sm:h-auto sm:max-h-[92dvh] sm:rounded-[var(--r-lg)]" style={{ background: "var(--surface)", boxShadow: "var(--sh-lg)" }}>
        <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-sm font-bold">{captura ? "Revisar foto" : "Foto da evidência"}</p>
          <button type="button" onClick={onFechar} className="icon-btn" aria-label="Fechar"><Fechar width={18} height={18} /></button>
        </div>

        {/* Área da imagem */}
        <div className="relative grid min-h-0 flex-1 place-items-center overflow-hidden" style={{ background: "#000" }}>
          {captura ? (
            <img src={captura.url} alt="Foto com carimbo" className="max-h-[68dvh] w-full object-contain" />
          ) : semCamera ? (
            <div className="p-8 text-center text-sm" style={{ color: "#cfe0da" }}>
              <p className="mb-1 font-semibold">Câmera ao vivo indisponível</p>
              <p className="opacity-80">Permita o acesso à câmera no navegador. No celular, a câmera ao vivo exige conexão segura (HTTPS). Se não for possível, use o botão abaixo para abrir a câmera do aparelho.</p>
            </div>
          ) : (
            <>
              <video ref={videoRef} playsInline muted autoPlay className="max-h-[68dvh] w-full object-contain" />
              {!pronto && <span className="spinner absolute" style={{ color: "#fff", width: 28, height: 28 }} />}
            </>
          )}
          {!captura && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3 text-[0.72rem] font-semibold" style={{ background: "linear-gradient(transparent, rgba(0,0,0,.7))", color: "#fff" }}>
              {gps ? `Lat ${gps.lat.toFixed(5)} · Lon ${gps.lon.toFixed(5)} · ${precisao}` : gpsErro ?? "Localizando…"} · hora será carimbada pela rede
            </div>
          )}
        </div>

        <div className="space-y-3 p-4" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
          {!captura && gpsErro && <p className="alert text-xs" role="alert">{gpsErro} A foto será carimbada como "Localização indisponível".</p>}
          {erro && <p className="alert text-xs" role="alert">{erro}</p>}
          {captura && (
            <p className="muted text-xs">
              Carimbo: <strong style={{ color: "var(--fg)" }}>{formatarHora(captura.hora)}</strong> (hora da rede) ·{" "}
              {captura.gps ? <>localização {captura.gps.lat.toFixed(5)}, {captura.gps.lon.toFixed(5)} ({`±${Math.round(captura.gps.acc)} m`})</> : "sem localização"}
            </p>
          )}

          {captura ? (
            <div className="flex gap-3">
              <button type="button" className="btn btn-g flex-1" disabled={ocupado} onClick={() => setCaptura(undefined)}>Refazer</button>
              <button type="button" className="btn btn-p flex-1" disabled={ocupado} onClick={usar}>
                {ocupado ? <><span className="spinner" /> Enviando…</> : <><Check width={18} height={18} /> Registrar foto</>}
              </button>
            </div>
          ) : semCamera ? (
            <label className="btn btn-p btn-block cursor-pointer">
              {ocupado ? <><span className="spinner" /> Carimbando…</> : "Abrir câmera do aparelho"}
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={aoEscolherArquivo} disabled={ocupado} />
            </label>
          ) : (
            <button type="button" className="btn btn-p btn-block" disabled={!pronto || ocupado} onClick={tirarFoto}>
              {ocupado ? <><span className="spinner" /> Carimbando…</> : "Tirar foto"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
