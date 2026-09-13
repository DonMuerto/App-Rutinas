import type { Metadata } from "next";

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
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
