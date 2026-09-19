import { useState, useTransition, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "@ritmo/ui";

import type { AuthServicePort } from "../contracts";

export function AuthForm({
  auth,
  mode,
  onSuccess,
}: {
  readonly auth: AuthServicePort;
  readonly mode: "login" | "register";
  readonly onSuccess?: () => void;
}) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const isLogin = mode === "login";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Escribe un email valido.");
      return;
    }
    if (password.length < 6) {
      setError("La contrasena debe tener al menos 6 caracteres.");
      return;
    }

    setError("");
    startTransition(async () => {
      try {
        const action = isLogin ? auth.login : auth.register;
        await action.call(auth, email, password);
        onSuccess?.();
      } catch {
        setError(
          isLogin
            ? "No pudimos iniciar sesion. Revisa tus datos o tu conexion."
            : "No pudimos crear la cuenta. Intenta nuevamente.",
        );
      }
    });
  }

  return (
    <form className="auth-form" noValidate onSubmit={handleSubmit}>
      <label htmlFor={`${mode}-email`}>
        Email
        <input
          aria-describedby={error ? `${mode}-error` : undefined}
          autoComplete="email"
          id={`${mode}-email`}
          inputMode="email"
          name="email"
          required
          type="email"
        />
      </label>
      <label htmlFor={`${mode}-password`}>
        Contrasena
        <input
          aria-describedby={error ? `${mode}-error` : undefined}
          autoComplete={isLogin ? "current-password" : "new-password"}
          id={`${mode}-password`}
          minLength={6}
          name="password"
          required
          type="password"
        />
      </label>
      {error ? (
        <p id={`${mode}-error`} role="alert">
          {error}
        </p>
      ) : null}
      <Button disabled={pending} type="submit" variant="primary">
        {pending
          ? isLogin
            ? "Iniciando sesion..."
            : "Creando cuenta..."
          : isLogin
            ? "Iniciar sesion"
            : "Crear cuenta"}
      </Button>
      <p className="auth-switch">
        {isLogin ? "No tienes cuenta?" : "Ya tienes cuenta?"}{" "}
        <Link to={isLogin ? "/registro" : "/login"}>
          {isLogin ? "Registrate" : "Inicia sesion"}
        </Link>
      </p>
    </form>
  );
}
