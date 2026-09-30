import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vela AI Academy",
  description: "Enterprise certification for the people who teach AI.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
