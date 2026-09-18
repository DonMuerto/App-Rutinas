"use client";

export default function RoutineError({
  reset,
}: {
  readonly reset: () => void;
}) {
  return (
    <main role="alert">
      <h1>No pudimos abrir la rutina</h1>
      <p>Revisa tu conexion e intenta nuevamente.</p>
      <button onClick={reset} type="button">
        Reintentar
      </button>
    </main>
  );
}
