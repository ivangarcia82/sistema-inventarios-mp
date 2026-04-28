// src/app/layout.tsx
import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Inventario Promocionales",
  description: "Sistema de Inventario de Promocionales Mercado Pago / Generando Ideas",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={dmSans.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
