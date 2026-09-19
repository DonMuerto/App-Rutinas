import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createDataAuthServices } from "@ritmo/data-auth";
import "@ritmo/features/styles.css";
import "@ritmo/ui/styles.css";

import { App } from "./app";
import { loadPlatformServices } from "./bootstrap";
import { ErrorBoundary } from "./error-boundary";
import { AppProviders, createAppQueryClient } from "./providers";
import type { DataAuthResult } from "./runtime-context";
import "./styles.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Ritmo root element was not found.");
}

const platform = await loadPlatformServices();
const queryClient = createAppQueryClient();
let data: DataAuthResult;
try {
  data = {
    status: "ready",
    services: createDataAuthServices({
      secureStorage: platform.secureStorage,
      queryClient,
    }),
  };
} catch (error) {
  data = {
    status: "configuration-error",
    error: error instanceof Error ? error : new Error(String(error)),
  };
}

window.addEventListener(
  "pagehide",
  () => {
    if (data.status === "ready") data.services.dispose();
    queryClient.clear();
    void platform.dispose();
  },
  {
    once: true,
  },
);

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary
      message="Tus datos locales permanecen protegidos. Intenta cargar la aplicacion nuevamente."
      title="Ritmo encontro un problema"
    >
      <AppProviders data={data} platform={platform} queryClient={queryClient}>
        <App />
      </AppProviders>
    </ErrorBoundary>
  </StrictMode>,
);
