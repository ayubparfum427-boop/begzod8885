import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin", "cyrillic"],
  variable: "--font-serif",
  weight: ["600", "700"],
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "AYUB CLUB PRO — Ayub Parfum Sodiqlik va CRM Tizimi",
  description:
    "Ayub Parfum do‘koni uchun professional QR sodiqlik, bonuslar, VIP mijozlar va CRM boshqaruv tizimi.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="uz"
      suppressHydrationWarning
      className={`${playfair.variable} ${jakarta.variable}`}
    >
      <body className="min-h-screen bg-[#F3F4F6] text-[#111827] dark:bg-[#111827] dark:text-[#F9FAFB] antialiased transition-colors duration-200">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
