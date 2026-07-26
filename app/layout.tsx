import type { Metadata } from "next";
import { Inter, Bricolage_Grotesque } from "next/font/google";
import { NavigationProgress } from "./components/NavigationProgress";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  weight: ["400", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tournament Guru — Find & Review Youth Sporting Events",
  description:
    "Compare youth tournaments using verified reviews from coaches, parents, and managers who actually attended. Find the right event for your team.",
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${bricolage.variable}`}>
      <body className="min-h-dvh overflow-x-hidden antialiased">
        <NavigationProgress />
        {children}
      </body>
    </html>
  );
}
