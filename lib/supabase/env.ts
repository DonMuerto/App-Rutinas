import { DomainError } from "@/lib/contracts";

export function getSupabaseEnvironment() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new DomainError(
      "NETWORK",
      "Falta configurar la conexion publica con Supabase.",
    );
  }

  return { url, anonKey };
}
