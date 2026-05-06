"use client";

import { useState } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Navbar } from "@/components/dashboard/navbar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      {/* Mobile overlay — shown when sidebar is open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Navbar onMenuClick={() => setSidebarOpen((v) => !v)} />

      <main className="lg:ml-60 pt-16 min-h-screen">
        <div className="p-4 md:p-6 max-w-7xl">{children}</div>
      </main>
    </>
  );
}
