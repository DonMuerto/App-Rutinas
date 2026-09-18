"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { initialAuthActionState, type AuthActionState } from "./auth-state";

type AuthFormProps = {
  action: (
    state: AuthActionState,
    formData: FormData,
  ) => Promise<AuthActionState>;
  mode: "login" | "register";
  next?: string;
};

function SubmitButton({ mode }: Pick<AuthFormProps, "mode">) {
  const { pending } = useFormStatus();

  return (
    <button
      className="mt-2 min-h-11 rounded-md bg-zinc-900 px-4 py-2 font-medium text-white disabled:cursor-wait disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950"
      disabled={pending}
      type="submit"
    >
      {pending
        ? mode === "login"
          ? "Iniciando sesion..."
          : "Creando cuenta..."
        : mode === "login"
          ? "Iniciar sesion"
          : "Crear cuenta"}
    </button>
  );
}

export function AuthForm({ action, mode, next }: AuthFormProps) {
  const [state, formAction] = useActionState(action, initialAuthActionState);
  const isLogin = mode === "login";

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      {next ? <input name="next" type="hidden" value={next} /> : null}
      <label className="grid gap-1.5 text-sm font-medium" htmlFor="email">
        Email
        <input
          autoComplete="email"
          className="min-h-11 rounded-md border border-zinc-300 bg-transparent px-3 outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-zinc-700"
          id="email"
          name="email"
          required
          type="email"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium" htmlFor="password">
        Contrasena
        <input
          autoComplete={isLogin ? "current-password" : "new-password"}
          className="min-h-11 rounded-md border border-zinc-300 bg-transparent px-3 outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-zinc-700"
          id="password"
          minLength={6}
          name="password"
          required
          type="password"
        />
      </label>
      {state.error ? (
        <p className="text-sm text-red-700 dark:text-red-300" role="alert">
          {state.error}
        </p>
      ) : null}
      <SubmitButton mode={mode} />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {isLogin ? "No tienes cuenta? " : "Ya tienes cuenta? "}
        <Link
          className="font-medium text-zinc-950 underline underline-offset-4 dark:text-white"
          href={isLogin ? "/registro" : "/login"}
        >
          {isLogin ? "Registrate" : "Inicia sesion"}
        </Link>
      </p>
    </form>
  );
}
