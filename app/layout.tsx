import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CTI Injetáveis | Gestão clínica",
  description: "Prontuário, prescrições, aplicações, estoque e recorrências da CTI.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
