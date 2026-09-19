/* eslint-disable react-refresh/only-export-components -- Provider factory and component share one bootstrap boundary. */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { HashRouter } from "react-router-dom";
import type { PlatformServices } from "@ritmo/platform";
import { ThemeProvider } from "@ritmo/ui";

import { PlatformProvider } from "./platform-context";
import { RuntimeProvider, type DataAuthResult } from "./runtime-context";

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

export function AppProviders({
  children,
  data,
  platform,
  queryClient,
}: PropsWithChildren<{
  data: DataAuthResult;
  platform: PlatformServices;
  queryClient: QueryClient;
}>) {
  const themeStorage = {
    async get() {
      const value = await platform.secureStorage.get("ritmo.theme.v1");
      return value === "light" || value === "dark" || value === "system"
        ? value
        : null;
    },
    async set(value: "light" | "dark" | "system") {
      await platform.secureStorage.set("ritmo.theme.v1", value);
    },
  };

  return (
    <PlatformProvider platform={platform}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider storage={themeStorage}>
          <HashRouter>
            <RuntimeProvider data={data} platform={platform}>
              {children}
            </RuntimeProvider>
          </HashRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </PlatformProvider>
  );
}
