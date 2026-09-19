import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { AuthForm, AuthScreen } from "@ritmo/features";
import { Button } from "@ritmo/ui";

import { PrivateApp } from "./private-app";
import { useRuntime } from "./runtime-context";

function AppState({ children }: { readonly children: React.ReactNode }) {
  return (
    <main className="app-state" id="main-content">
      {children}
    </main>
  );
}

function AuthRoute({ mode }: { readonly mode: "login" | "register" }) {
  const navigate = useNavigate();
  const { auth, data } = useRuntime();
  if (data.status !== "ready") return <Navigate replace to="/" />;
  if (auth.user) return <Navigate replace to="/hoy" />;

  return (
    <AuthScreen mode={mode}>
      <AuthForm
        auth={data.services.auth}
        mode={mode}
        onSuccess={() => navigate("/hoy", { replace: true })}
      />
    </AuthScreen>
  );
}

function PrivateRoute() {
  const { auth, data, platform } = useRuntime();
  if (data.status !== "ready") return <Navigate replace to="/" />;
  if (auth.status === "initializing") {
    return <AppState>Restaurando tu sesion...</AppState>;
  }
  if (!auth.user) return <Navigate replace to="/login" />;
  return (
    <PrivateApp
      key={auth.user.id}
      platform={platform}
      services={data.services}
      user={auth.user}
    />
  );
}

function ConfigurationError() {
  const { data } = useRuntime();
  if (data.status === "ready") return <Navigate replace to="/hoy" />;
  return (
    <AppState>
      <section aria-labelledby="configuration-title" role="alert">
        <p className="eyebrow">Configuracion requerida</p>
        <h1 id="configuration-title">Ritmo</h1>
        <p>{data.error.message}</p>
        <p>
          Define las variables publicas de Supabase para iniciar el cliente
          compartido.
        </p>
      </section>
    </AppState>
  );
}

function NetworkError() {
  const { data } = useRuntime();
  if (data.status !== "ready") return <Navigate replace to="/" />;
  return (
    <AppState>
      <section aria-labelledby="network-title" role="alert">
        <h1 id="network-title">No pudimos validar tu sesion</h1>
        <p>Revisa tu conexion e intenta nuevamente.</p>
        <Button
          onClick={() => void data.services.auth.initialize()}
          variant="primary"
        >
          Reintentar
        </Button>
      </section>
    </AppState>
  );
}

export function App() {
  const { auth, data } = useRuntime();
  if (data.status === "configuration-error") return <ConfigurationError />;
  if (auth.status === "network-error" && !auth.user) return <NetworkError />;

  return (
    <Routes>
      <Route path="/login" element={<AuthRoute mode="login" />} />
      <Route path="/registro" element={<AuthRoute mode="register" />} />
      <Route path="/*" element={<PrivateRoute />} />
    </Routes>
  );
}
