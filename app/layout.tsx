import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthBadge } from "./AuthBadge";
import { I18nProvider, LANG_INIT_SCRIPT } from "@/lib/i18n/context.tsx";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-cormorant",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PX Registry",
  description: "Public register of owner-domain activity.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${cormorant.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        {/* Resolve the language preference and set <html lang> before paint. */}
        <script dangerouslySetInnerHTML={{ __html: LANG_INIT_SCRIPT }} />
        <I18nProvider>
          <AuthBadge />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
