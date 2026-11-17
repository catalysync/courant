import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { TRPCProvider } from "@/trpc/client";
import { Toaster } from "@/components/ui/sonner";
import { PwaRegister } from "@/components/pwa-register";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Courant",
  description: "Your Video Universe",
  manifest: "/manifest.webmanifest",
  themeColor: "#3b82f6",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Courant",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <TRPCProvider>
          <Toaster />
          <PwaRegister />
          {children}
        </TRPCProvider>
      </body>
    </html>
  );
}