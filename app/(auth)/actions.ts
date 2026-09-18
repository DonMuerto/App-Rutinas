"use server";

import { redirect } from "next/navigation";
import type { AuthResponse } from "@supabase/supabase-js";
import { z } from "zod";

import { safeAuthenticatedDestination } from "@/lib/supabase/auth-redirect";
import { createServerActionSupabaseClient } from "@/lib/supabase/server";

import type { AuthActionState } from "./auth-state";

const credentialsSchema = z.object({
  email: z.email("Ingresa un email valido."),
  password: z
    .string()
    .min(6, "La contrasena debe tener al menos 6 caracteres."),
});

function safeDestination(formData: FormData) {
  return safeAuthenticatedDestination(formData.get("next"));
}

function parseCredentials(formData: FormData) {
  return credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
}

export async function loginAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const credentials = parseCredentials(formData);

  if (!credentials.success) {
    return {
      error: credentials.error.issues[0]?.message ?? "Datos invalidos.",
    };
  }

  let error: { status?: number } | null;

  try {
    const supabase = await createServerActionSupabaseClient();
    ({ error } = await supabase.auth.signInWithPassword(credentials.data));
  } catch {
    return { error: "No se pudo iniciar sesion. Intenta nuevamente." };
  }

  if (error) {
    return {
      error:
        error.status === 400
          ? "Email o contrasena incorrectos."
          : "No se pudo iniciar sesion. Intenta nuevamente.",
    };
  }

  redirect(safeDestination(formData));
}

export async function registerAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const credentials = parseCredentials(formData);

  if (!credentials.success) {
    return {
      error: credentials.error.issues[0]?.message ?? "Datos invalidos.",
    };
  }

  let result: AuthResponse;

  try {
    const supabase = await createServerActionSupabaseClient();
    result = await supabase.auth.signUp(credentials.data);
  } catch {
    return { error: "No se pudo crear la cuenta. Intenta nuevamente." };
  }

  const { data, error } = result;

  if (error) {
    return { error: "No se pudo crear la cuenta. Revisa los datos." };
  }

  if (!data.session) {
    return {
      error:
        "El registro requiere una confirmacion no habilitada para este MVP.",
    };
  }

  redirect(safeDestination(formData));
}

export async function logoutAction() {
  let failed = false;

  try {
    const supabase = await createServerActionSupabaseClient();
    const { error } = await supabase.auth.signOut();
    failed = error !== null;
  } catch {
    failed = true;
  }

  if (failed) {
    redirect("/hoy?authError=logout");
  }

  redirect("/login?logout=1");
}
