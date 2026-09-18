import { AuthForm } from "../auth-form";
import { registerAction } from "../actions";

type RegisterPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function RegisterPage({
  searchParams,
}: RegisterPageProps) {
  const { next } = await searchParams;

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Crea tu espacio</h1>
      <p className="mt-2 mb-8 text-zinc-600 dark:text-zinc-400">
        Tus documentos y completados quedan privados por defecto.
      </p>
      <AuthForm action={registerAction} mode="register" next={next} />
    </>
  );
}
