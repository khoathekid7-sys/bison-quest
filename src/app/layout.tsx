import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { asset } from "@/lib/site";

const fredoka = Fredoka({ variable: "--font-fredoka", subsets: ["latin"], weight: ["500", "600", "700"] });
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"], weight: ["400", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "Bison Quest — Find the campus hiding in plain sight",
  description:
    "A photo scavenger hunt across Bucknell University. Solve clues, walk to real places, photograph them, and collect gems.",
  applicationName: "Bison Quest",
  appleWebApp: { capable: true, title: "Bison Quest", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: asset("icons/favicon-48.png"), sizes: "48x48", type: "image/png" }, { url: asset("icons/icon.svg"), type: "image/svg+xml" }],
    apple: [{ url: asset("icons/apple-touch-icon.png"), sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b2545",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fredoka.variable} ${nunito.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
