import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { APP_DESCRIPTION, APP_NAME } from "@/lib/constants";
import { getPublicEnv } from "@/lib/env";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { SkipLink } from "@/components/layout/skip-link";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(getPublicEnv().NEXT_PUBLIC_APP_URL),
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Layout racine de Merlin : langue française, lien d'évitement, en-tête,
 * zone de contenu principale et pied de page.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${inter.variable} flex min-h-screen flex-col antialiased`}
      >
        <SkipLink />
        <Header />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
