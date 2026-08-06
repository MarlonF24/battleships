/**
 * Provide the shared page frame and its optional game-specific height cascade.
 *
 * `gameLayout` marks routes whose board must take priority over decorative
 * chrome on short screens. CSS uses that marker to hide the title and match ID
 * in stages while the welcome route keeps its ordinary centered-card layout.
 */

import type { PropsWithChildren } from "react";
import { Link } from "react-router-dom";

export function AppShell({
  children,
  gameLayout = false,
}: PropsWithChildren<Readonly<{ gameLayout?: boolean }>>) {
  return (
    <div
      className={`app-shell bg-page h-dvh overflow-hidden${gameLayout ? "game-shell" : ""}`}
    >
      <section
        role="status"
        className="orientation-guard h-dvh flex-col items-center justify-center gap-3 px-8 text-center"
      >
        <span aria-hidden="true" className="text-primary text-5xl">
          ↻
        </span>
        <strong className="text-primary text-xl">Rotate your device</strong>
        <p className="max-w-sm text-sm text-[#666] italic">
          Battleship uses a landscape game board so ships and controls stay at a
          useful size.
        </p>
      </section>
      <header className="app-title-bar bg-header py-5 text-center text-white shadow-[0_2px_8px_rgb(0_0_0/0.04)]">
        <Link
          to="/"
          className="inline-block rounded-sm text-[2.5rem] leading-tight font-black tracking-tight"
        >
          Battleship
        </Link>
      </header>
      <main className="app-main mx-auto flex w-full max-w-[1200px] flex-col items-center overflow-hidden px-2 py-3 sm:px-4 sm:py-5">
        {children}
      </main>
    </div>
  );
}
