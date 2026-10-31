import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "BayPass",
  description: "Know your parking slot before you reach the basement.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "BayPass", statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: "#1c4fb8", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Hind:wght@400;500;600&family=JetBrains+Mono:wght@500;700&display=swap"
        />
      </head>
      <body>
        <div className="app">
          <header className="top">
            <div className="logo" aria-hidden="true">P</div>
            <div>
              <h1>BayPass</h1>
              <small>Know your slot before you reach the basement</small>
            </div>
          </header>
          <Nav />
          <main className="app" style={{ padding: 0 }}>{children}</main>
        </div>
      </body>
    </html>
  );
}
