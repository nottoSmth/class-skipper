import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import FirebaseTokenFetcher from "@/lib/client/client.firebaseTokenFetcher";

import { FirebaseContextProvider } from "@/lib/client/context/firebaseContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "App Name WOW",
  description: "Amazing",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <FirebaseContextProvider>
          <FirebaseTokenFetcher />
          {children}
        </FirebaseContextProvider>
      </body>
    </html>
  );
}
