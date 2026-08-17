/** Miniature legacy fleet strip derived from a server board projection. */

import type { BoardView } from "@battleship/contracts";
import { cn } from "./ui";

function count(lengths: readonly number[], expected: number): number {
  return lengths.filter((length) => length === expected).length;
}

/** Render the legacy outer fleet silhouette from public remaining lengths. */
export function FleetDisplay({
  fleetLengths,
  board,
  side,
}: Readonly<{
  fleetLengths: readonly number[];
  board: BoardView;
  side: "left" | "right";
}>) {
  const lengths = [...new Set(fleetLengths)].toSorted(
    (first, second) => second - first,
  );

  return (
    <div
      aria-label={`${board.remainingShipLengths.length} ships afloat`}
      className={cn(
        "fleet-display flex shrink-0 flex-col gap-[var(--fleet-gap)]",
        side === "left" ? "items-end" : "items-start",
      )}
    >
      {lengths.map((length) => {
        const total = count(fleetLengths, length);
        const afloat = count(board.remainingShipLengths, length);
        return (
          <div key={length} className="flex gap-[var(--fleet-gap)]">
            {Array.from({ length: total }, (_, shipIndex) => (
              <div key={shipIndex} className="flex" aria-hidden="true">
                {Array.from({ length }, (_, cellIndex) => (
                  <span
                    key={cellIndex}
                    className={cn(
                      "block size-[var(--fleet-cell-size)] border-2 border-black",
                      shipIndex < afloat ? "bg-[#d3d3d3]" : "bg-red-500",
                    )}
                  />
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
