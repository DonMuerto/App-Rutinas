import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-zinc-50 px-5 py-12 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <section className="w-full max-w-sm">
        <p className="mb-8 text-sm font-semibold tracking-[0.2em] text-amber-700 uppercase dark:text-amber-400">
          Ritmo
        </p>
        {children}
      </section>
    </main>
  );
}
