const AUTHENTICATED_PATHS = ["/hoy", "/rutinas"];

export function safeAuthenticatedDestination(destination: unknown) {
  if (typeof destination !== "string" || destination.includes("\\")) {
    return "/hoy";
  }

  try {
    const base = new URL("http://ritmo.local");
    const parsed = new URL(destination, base);
    const isAuthenticatedPath = AUTHENTICATED_PATHS.some(
      (path) =>
        parsed.pathname === path || parsed.pathname.startsWith(`${path}/`),
    );

    if (parsed.origin === base.origin && isAuthenticatedPath) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    return "/hoy";
  }

  return "/hoy";
}
