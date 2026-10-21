/** Fundo animado (aurora + grade) usado nas telas de entrada. Fica atrás de todo o conteúdo. */
export default function Fundo() {
  return (
    <>
      <div className="aurora" aria-hidden="true"><i /><i /><i /></div>
      <div className="grid-bg" aria-hidden="true" />
    </>
  );
}
