import { useEffect, useState, type ReactNode } from "react";

import {
  ThemeContext,
  type ResolvedTheme,
  type ThemePreference,
  type ThemeStorage,
} from "./theme-context";

function systemTheme(): ResolvedTheme {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeProvider({
  children,
  storage,
}: {
  readonly children: ReactNode;
  readonly storage?: ThemeStorage;
}) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [systemPreference, setSystemPreference] =
    useState<ResolvedTheme>(systemTheme);
  const resolvedTheme = preference === "system" ? systemPreference : preference;

  useEffect(() => {
    if (!storage) return;
    let active = true;
    void storage
      .get()
      .then((stored) => {
        if (active && stored) setPreferenceState(stored);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [storage]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemPreference(media.matches ? "dark" : "light");
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  function setPreference(nextPreference: ThemePreference) {
    setPreferenceState(nextPreference);
    void storage?.set(nextPreference).catch(() => undefined);
  }

  return (
    <ThemeContext value={{ preference, resolvedTheme, setPreference }}>
      {children}
    </ThemeContext>
  );
}
