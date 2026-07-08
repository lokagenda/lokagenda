import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "@/components/theme-provider";
import { PWARegister } from "@/components/pwa-register";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LokAgenda - Sistema de Locação",
  description:
    "Sistema completo para gestão de locação de brinquedos e equipamentos para festas e eventos",
  applicationName: "LokAgenda",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LokAgenda",
  },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50" suppressHydrationWarning>
        <ThemeProvider>
          <PWARegister />
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              className: "!bg-white !text-zinc-900 dark:!bg-zinc-800 dark:!text-zinc-50 !shadow-lg !border !border-zinc-200 dark:!border-zinc-700",
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
