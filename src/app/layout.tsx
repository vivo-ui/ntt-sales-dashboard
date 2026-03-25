import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NUBIA NTT - Dashboard Sell Out",
  description: "Dashboard Penjualan Area Nusa Tenggara Timur",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Memuat Material Icons agar ikon di dashboard muncul */}
        <link
          href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/icon?family=Material+Icons"
          rel="stylesheet"
        />
      </head>
      <body className={`${manrope.className} bg-[#0b1326] text-[#dae2fd] antialiased`}>
        {children}
      </body>
    </html>
  );
}
