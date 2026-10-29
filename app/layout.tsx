import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, Noto_Naskh_Arabic } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { getPublicSettings } from "@/lib/settings";

const plexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
});

const naskhArabic = Noto_Naskh_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-naskh",
  display: "swap",
});

async function loadSettings() {
  try {
    return await getPublicSettings();
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const s = await loadSettings();
  if (!s) return {};
  return {
    title: { default: s.seoTitle || s.siteName, template: `%s | ${s.siteName}` },
    description: s.seoDescription || s.tagline,
    applicationName: s.siteName,
    openGraph: {
      title: s.seoTitle || s.siteName,
      description: s.seoDescription || s.tagline,
      siteName: s.siteName,
      locale: "ar_KW",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
    },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: "#101010",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const s = await loadSettings();
  const styleVars = s
    ? ({
        "--primary": s.primaryColor,
        "--ring": s.primaryColor,
        "--gold": s.primaryColor,
        "--background": s.backgroundColor,
        "--foreground": s.ivoryColor,
      } as React.CSSProperties)
    : undefined;

  return (
    <html
      lang="ar"
      dir="rtl"
      className={`dark ${plexSansArabic.variable} ${naskhArabic.variable}`}
      suppressHydrationWarning
    >
      <body
        className="font-sans antialiased bg-background text-foreground min-h-screen"
        style={styleVars}
      >
        {children}
        <Toaster position="top-center" dir="rtl" gap={6} />
      </body>
    </html>
  );
}
