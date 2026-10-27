/**
 * Logo da CGB Energia em neon vazado: só o contorno das letras e do símbolo brilha (o miolo fica transparente),
 * com halo em três camadas. A cor do neon vem de `color` (animada no CSS) e o arquivo da logo é branco com fundo transparente.
 */
export default function LogoNeon({ className = "" }: { className?: string }) {
  const src = `${import.meta.env.BASE_URL}logo-cgb.png`;
  return (
    <svg viewBox="-160 -160 1832 916" className={`logo-neon ${className}`} role="img" aria-label="CGB Energia"
      style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <filter id="neon-cgb" x="-20%" y="-60%" width="140%" height="220%" colorInterpolationFilters="sRGB">
          {/* contorno = imagem engrossada menos a imagem original */}
          <feMorphology in="SourceAlpha" operator="dilate" radius="6" result="grosso" />
          <feComposite in="grosso" in2="SourceAlpha" operator="out" result="contorno" />
          <feFlood floodColor="currentColor" result="cor" />
          <feComposite in="cor" in2="contorno" operator="in" result="anel" />
          {/* halo: três desfoques somados */}
          <feGaussianBlur in="anel" stdDeviation="9" result="g1" />
          <feGaussianBlur in="anel" stdDeviation="26" result="g2" />
          <feGaussianBlur in="anel" stdDeviation="60" result="g3" />
          <feMerge>
            <feMergeNode in="g3" />
            <feMergeNode in="g2" />
            <feMergeNode in="g1" />
            <feMergeNode in="anel" />
            <feMergeNode in="anel" />
          </feMerge>
        </filter>
      </defs>
      <image href={src} x="0" y="0" width="1512" height="596" filter="url(#neon-cgb)" />
      {/* vidro leve dentro das letras */}
      <image href={src} x="0" y="0" width="1512" height="596" opacity=".07" />
    </svg>
  );
}
