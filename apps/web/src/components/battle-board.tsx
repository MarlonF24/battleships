/** Legacy battle grid rendered solely from a complete server projection. */

import type { CSSProperties } from "react";
import type { BoardView, LastShot } from "@battleship/contracts";
import { placementCoordinates } from "@battleship/game-domain";
import { cn } from "./ui";

type BoardProps = Readonly<{
  board: BoardView;
  label: string;
  interactive?: boolean;
  opacity?: number;
  onTarget?: (row: number, column: number) => void;
  highlightedCoordinate?: LastShot | null;
}>;

function coordinateName(row: number, column: number): string {
  return `${String.fromCharCode(65 + column)}${row + 1}`;
}

/** Render hits and revealed ships without inferring any unseen game state. */
/** Render one server-projected board and optional player target controls. */
export function BattleBoard({
  board,
  label,
  interactive = false,
  opacity = 1,
  onTarget,
  highlightedCoordinate = null,
}: BoardProps) {
  const rows = board.cells.length;
  const columns = board.cells[0]?.length ?? 0;
  const occupied = new Set(
    board.ships.flatMap((ship) =>
      placementCoordinates(ship).map(({ row, column }) => `${row}:${column}`),
    ),
  );

  return (
    <section
      className="shrink-0 transition-opacity duration-200"
      style={{ opacity }}
    >
      <h2 className="sr-only">{label}</h2>
      <div
        role="grid"
        aria-label={label}
        className="legacy-grid"
        style={
          {
            "--grid-columns": columns,
            "--grid-rows": rows,
          } as CSSProperties
        }
      >
        {board.cells.flatMap((rowCells, row) =>
          rowCells.map((cell, column) => {
            const canTarget = interactive && cell === "unknown";
            const hasShip = occupied.has(`${row}:${column}`);
            const isLatestShot =
              highlightedCoordinate?.row === row &&
              highlightedCoordinate.column === column;
            const resultLabel =
              cell === "unknown" ? (hasShip ? "your ship" : "untouched") : cell;
            return (
              <button
                key={`${row}:${column}`}
                type="button"
                role="gridcell"
                aria-label={`${coordinateName(row, column)}, ${resultLabel}${isLatestShot ? ", most recent shot" : ""}`}
                disabled={!canTarget}
                onClick={() => onTarget?.(row, column)}
                style={{ gridRow: row + 1, gridColumn: column + 1 }}
                className={cn(
                  "legacy-cell relative z-30 flex items-center justify-center bg-transparent p-0",
                  cell === "unknown" && !hasShip && "bg-battle-cell",
                  canTarget &&
                    "cursor-crosshair hover:bg-[#90caf9] focus-visible:z-40",
                  isLatestShot && "recent-shot",
                )}
              >
                {cell === "hit" && (
                  <svg
                    aria-hidden="true"
                    className="block size-full"
                    viewBox="0 0 24 24"
                  >
                    <line
                      x1="0"
                      y1="0"
                      x2="24"
                      y2="24"
                      stroke="red"
                      strokeWidth="2"
                    />
                    <line
                      x1="24"
                      y1="0"
                      x2="0"
                      y2="24"
                      stroke="red"
                      strokeWidth="2"
                    />
                  </svg>
                )}
                {(cell === "miss" || cell === "impossible") && (
                  <svg
                    aria-hidden="true"
                    className={cn(
                      "block size-full",
                      cell === "miss" ? "opacity-90" : "opacity-40",
                    )}
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="12" r="3" fill="blue" />
                  </svg>
                )}
              </button>
            );
          }),
        )}

        {board.ships.map((ship) => (
          <div
            key={ship.id}
            aria-hidden="true"
            className="legacy-ship pointer-events-none"
            style={{
              gridColumn: `${ship.headColumn + 1} / span ${ship.orientation === "horizontal" ? ship.length : 1}`,
              gridRow: `${ship.headRow + 1} / span ${ship.orientation === "vertical" ? ship.length : 1}`,
            }}
          />
        ))}
      </div>
    </section>
  );
}
