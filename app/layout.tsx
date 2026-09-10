import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { PwaInstall } from "@/components/pwa-install";

const nunito = Nunito({
  subsets: ["latin", "vietnamese"],
  variable: "--font-nunito",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Ladysfit - Quản lý Phòng Gym",
  description: "Hệ thống quản lý phòng gym Ladysfit",
  // Cài vào iPhone thì mở toàn màn hình như app, tên dưới icon là "Ladysfit".
  appleWebApp: {
    capable: true,
    title: "Ladysfit",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

// Khớp bề rộng máy và tô thanh trạng thái theo màu thương hiệu khi mở dạng app.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f15b5c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={`${nunito.variable} font-nunito antialiased`}>
        <Providers>{children}</Providers>
        <PwaInstall />
      </body>
    </html>
  );
}
