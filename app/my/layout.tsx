import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import { ClientSessionProvider } from "@/components/my/client-session-provider";

const nunito = Nunito({ subsets: ["latin"], weight: ["400", "600", "700", "800", "900"] });

// Đè bản khai của thư mục gốc: ở khu hội viên thì cài ra app mở thẳng /my,
// tên dưới icon là "LOTS".
export const metadata: Metadata = {
  title: "Ladysfit — Trang của tôi",
  manifest: "/my/manifest.webmanifest",
  appleWebApp: { capable: true, title: "LOTS", statusBarStyle: "default" },
};

export default function MyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={nunito.className}>
      <ClientSessionProvider>{children}</ClientSessionProvider>
    </div>
  );
}
