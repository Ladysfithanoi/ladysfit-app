"use client";

import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    // refetchInterval: re-validate the JWT every 30 min while the tab is open,
    //   extending the rolling session without a full page reload.
    // refetchOnWindowFocus: re-validate immediately when the user returns to the
    //   app/tab (critical on mobile where apps are backgrounded and resumed).
    <SessionProvider
      refetchInterval={30 * 60}
      refetchOnWindowFocus={true}
    >
      {children}
    </SessionProvider>
  );
}
