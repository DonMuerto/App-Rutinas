"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { IconButton } from "@/components/ui";

const subscribeToMount = () => () => {};
const getClientMountState = () => true;
const getServerMountState = () => false;

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribeToMount,
    getClientMountState,
    getServerMountState,
  );

  if (!mounted) {
    return (
      <IconButton disabled label="Cambiar tema">
        <span aria-hidden="true" />
      </IconButton>
    );
  }

  const isDark = resolvedTheme === "dark";
  const label = isDark ? "Usar tema claro" : "Usar tema oscuro";

  return (
    <IconButton
      label={label}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? (
        <Sun aria-hidden="true" size={18} />
      ) : (
        <Moon aria-hidden="true" size={18} />
      )}
    </IconButton>
  );
}
