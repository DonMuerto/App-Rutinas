import type { Metadata } from "next";

import { ThemeProvider } from "@/components/theme";

import "./globals.css";

export const metadata: Metadata = {
  title: "Ritmo",
  description: "Editor de rutinas con actividades ejecutables.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
