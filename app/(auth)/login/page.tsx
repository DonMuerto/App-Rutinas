import { AuthForm } from "../auth-form";
import { loginAction } from "../actions";

type LoginPageProps = {
  searchParams: Promise<{ logout?: string; next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { logout, next } = await searchParams;

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">
        Vuelve a tu ritmo
      </h1>
      <p className="mt-2 mb-8 text-zinc-600 dark:text-zinc-400">
        Abre tus rutinas y continua donde estabas.
      </p>
      {logout === "1" ? (
        <p
          className="mb-5 rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
          role="status"
        >
          Sesion cerrada.
        </p>
      ) : null}
      <AuthForm action={loginAction} mode="login" next={next} />
    </>
  );
}
