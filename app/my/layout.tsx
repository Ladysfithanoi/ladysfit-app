import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import { ClientSessionProvider } from "@/components/my/client-session-provider";

const nunito = Nunito({ subsets: ["latin"], weight: ["400", "600", "700", "800", "900"] });

export const metadata: Metadata = { title: "Ladysfit — Trang của tôi" };

export default function MyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={nunito.className}>
      <ClientSessionProvider>{children}</ClientSessionProvider>
    </div>
  );
}
