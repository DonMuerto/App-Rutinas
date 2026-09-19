import { IconButton } from "./button";
import { Icon } from "./icon";
import { useTheme } from "./use-theme";

export function ThemeToggle() {
  const { resolvedTheme, setPreference } = useTheme();
  const nextTheme = resolvedTheme === "dark" ? "light" : "dark";

  return (
    <IconButton
      label={`Usar tema ${nextTheme === "dark" ? "oscuro" : "claro"}`}
      onClick={() => setPreference(nextTheme)}
    >
      <Icon
        height="19"
        name={resolvedTheme === "dark" ? "sun" : "moon"}
        width="19"
      />
    </IconButton>
  );
}
