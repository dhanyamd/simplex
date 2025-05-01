import type { Metadata } from "next";
import {Inter} from 'next/font/google'
import "./globals.css";

const inter = Inter({
  //variable: "--font-geist-sans",
  subsets: ["latin"],
});


export const metadata: Metadata = {
  title: "Simplex - Your Accelerated Research Partner",
  description: "Bring your explorations to life. What do you want to research?",
  openGraph: {
    title: "Simplex - Your Accelerated Research Partner",
    description: "Bring your explorations to life. What do you want to research?",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Simplex Open Graph Image",
      },
    ],
    type: "website",
    url: "https://www.simplexx.xyz",
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.className}  antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
