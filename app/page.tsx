import Link from "next/link";

import { ThemeToggle } from "@/components/theme";

export default function Home() {
  return (
    <main className="landing-page">
      <header className="landing-header">
        <Link className="landing-brand" href="/" aria-label="Ritmo, inicio">
          <span aria-hidden="true" className="landing-brand-mark">
            R
          </span>
          <span>Ritmo</span>
        </Link>
        <div className="landing-header-actions">
          <Link className="landing-nav-link" href="/hoy">
            Abrir Hoy
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <div className="landing-layout">
        <section className="landing-copy" aria-labelledby="landing-title">
          <p className="landing-kicker">Editor de rutinas</p>
          <h1 className="landing-title" id="landing-title">
            Hazle espacio a lo que quieres sostener.
          </h1>
          <p className="landing-description">
            Un documento libre para pensar, ordenar y convertir tus intenciones
            en actividades que puedes ejecutar sin salir de contexto.
          </p>
          <div className="landing-actions">
            <Link
              className="ui-button"
              data-size="lg"
              data-variant="primary"
              href="/hoy"
            >
              Entrar al espacio de trabajo
            </Link>
            <Link
              className="ui-button"
              data-size="lg"
              data-variant="secondary"
              href="/hoy"
            >
              Ver la vista Hoy
            </Link>
          </div>
          <p className="landing-footnote">
            Tus rutinas siguen siendo páginas. Las actividades viven dentro de
            ellas.
          </p>
        </section>

        <aside className="landing-document" aria-label="Ejemplo de una rutina">
          <p className="landing-document-meta">Martes · página de rutina</p>
          <h2 className="landing-document-title">Noche</h2>
          <p className="landing-document-line">
            <span aria-hidden="true">○</span>
            <strong>Lectura</strong>
            <time dateTime="22:45">22:45</time>
          </p>
          <p className="landing-document-line">
            <span aria-hidden="true">□</span>
            <span>Preparar el espacio</span>
          </p>
          <div aria-hidden="true" className="landing-document-rule" />
        </aside>
      </div>
    </main>
  );
}
