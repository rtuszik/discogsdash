import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Discogs Collection IQ",
  description: "Discogs Collection Statistics Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
