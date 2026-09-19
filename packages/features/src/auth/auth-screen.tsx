import type { ReactNode } from "react";
import { ThemeToggle } from "@ritmo/ui";

export function AuthScreen({
  children,
  mode,
}: {
  readonly children: ReactNode;
  readonly mode: "login" | "register";
}) {
  return (
    <main className="auth-page" id="main-content">
      <header className="auth-header">
        <span aria-hidden="true" className="auth-mark">
          R
        </span>
        <ThemeToggle />
      </header>
      <section aria-labelledby="auth-title" className="auth-panel">
        <div className="auth-intro">
          <h1 id="auth-title">
            {mode === "login" ? "Vuelve a tu ritmo" : "Empieza una pagina viva"}
          </h1>
          <p>
            Documentos libres, actividades ejecutables y tiempo con contexto.
          </p>
        </div>
        {children}
      </section>
    </main>
  );
}
