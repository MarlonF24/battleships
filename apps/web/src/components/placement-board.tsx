/** Responsive legacy board and garage with a custom Pointer Events drag loop. */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { observer } from "mobx-react-lite";
import { PlacementDragSession } from "../stores/placement-drag-session";
import {
  PlacementDraftStore,
  type DraftShip,
} from "../stores/placement-draft-store";
import { Button, cn } from "./ui";

const BOARD_BORDER_PX = 2;

type GridStyle = CSSProperties &
  Readonly<Record<"--grid-columns" | "--grid-rows", number>>;

type CloneStyle = CSSProperties & Readonly<Record<"--rotation-angle", string>>;

function gridStyle(rows: number, columns: number): GridStyle {
  return { "--grid-columns": columns, "--grid-rows": rows };
}

function shipStyle(
  ship: Pick<DraftShip, "length" | "orientation">,
  row: number,
  column: number,
): CSSProperties {
  return {
    gridColumn: `${column + 1} / span ${ship.orientation === "horizontal" ? ship.length : 1}`,
    gridRow: `${row + 1} / span ${ship.orientation === "vertical" ? ship.length : 1}`,
  };
}

type ShipButtonProps = Readonly<{
  ship: DraftShip;
  row: number;
  column: number;
  source: "board" | "garage";
  dimmed: boolean;
  locked: boolean;
  onPointerDown: (
    event: ReactPointerEvent<HTMLButtonElement>,
    ship: DraftShip,
  ) => void;
  onKeyDown: (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    ship: DraftShip,
  ) => void;
}>;

function ShipButton({
  ship,
  row,
  column,
  source,
  dimmed,
  locked,
  onPointerDown,
  onKeyDown,
}: ShipButtonProps) {
  return (
    <button
      type="button"
      disabled={locked}
      aria-label={`Length-${ship.length} ship in the ${source}. Press Space or Enter to move it.`}
      className={cn(
        "legacy-ship cursor-grab touch-none transition-[transform,background-color,border-color,opacity] duration-100 active:cursor-grabbing enabled:hover:scale-105 enabled:hover:border-[#1b5e20] enabled:hover:bg-[#388e3c]",
        dimmed && "opacity-70 shadow-[0_4px_12px_rgb(0_0_0/0.2)]",
      )}
      style={shipStyle(ship, row, column)}
      onPointerDown={(event) => onPointerDown(event, ship)}
      onKeyDown={(event) => onKeyDown(event, ship)}
    />
  );
}

/** Render the board, vertical garage, and unified pointer/keyboard drag layer. */
export const PlacementBoard = observer(function PlacementBoard({
  store,
}: Readonly<{ store: PlacementDraftStore }>) {
  const [drag] = useState(() => new PlacementDragSession(store));
  const boardRef = useRef<HTMLDivElement>(null);
  const garageRef = useRef<HTMLDivElement>(null);
  const capturedElement = useRef<HTMLButtonElement | null>(null);
  const capturedPointerId = useRef<number | null>(null);
  const [cellSize, setCellSize] = useState(30);

  // Measure the rendered tracks so the clone, board, and garage share geometry.
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const update = (): void => {
      const width = board.getBoundingClientRect().width - BOARD_BORDER_PX * 2;
      if (width > 0) setCellSize(width / store.rules.columns);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(board);
    return () => observer.disconnect();
  }, [store.rules.columns]);

  const findPointerTarget = useCallback((): void => {
    const centre = drag.cloneCentre;
    if (!centre) {
      drag.clearTarget();
      return;
    }
    const board = boardRef.current?.getBoundingClientRect();
    if (board) {
      const gridX = (centre.x - board.left - BOARD_BORDER_PX) / cellSize;
      const gridY = (centre.y - board.top - BOARD_BORDER_PX) / cellSize;
      if (
        gridX >= 0 &&
        gridX < store.rules.columns &&
        gridY >= 0 &&
        gridY < store.rules.rows
      ) {
        const column = Math.floor(gridX);
        const row = Math.floor(gridY);
        drag.suggestAt(row, column, {
          x: gridX - column,
          y: gridY - row,
        });
        return;
      }
    }

    // The clone centre also controls garage return, matching the retained interaction.
    const garage = garageRef.current?.getBoundingClientRect();
    if (
      garage &&
      centre.x >= garage.left &&
      centre.x <= garage.right &&
      centre.y >= garage.top &&
      centre.y <= garage.bottom
    ) {
      drag.suggestGarage();
      return;
    }
    drag.clearTarget();
  }, [cellSize, drag, store.rules.columns, store.rules.rows]);

  // One listener set owns movement, rotation, placement, and idempotent cleanup.
  useEffect(() => {
    if (!drag.active) return;
    document.body.classList.add("dragging-ships");
    document.body.style.cursor = "grabbing";

    const releaseVisualState = (): void => {
      document.body.classList.remove("dragging-ships");
      document.body.style.cursor = "";
      const element = capturedElement.current;
      const pointerId = capturedPointerId.current;
      if (
        element &&
        pointerId !== null &&
        element.hasPointerCapture(pointerId)
      ) {
        element.releasePointerCapture(pointerId);
      }
      capturedElement.current = null;
      capturedPointerId.current = null;
    };
    const updateTarget = (): void => {
      findPointerTarget();
    };
    const onPointerMove = (event: PointerEvent): void => {
      if (event.pointerId !== drag.pointerId) return;
      event.preventDefault();
      drag.updatePointer(event);
      updateTarget();
    };
    const onPointerUp = (event: PointerEvent): void => {
      if (event.pointerId !== drag.pointerId) return;
      event.preventDefault();
      drag.updatePointer(event);
      findPointerTarget();
      drag.commit();
      releaseVisualState();
    };
    const onPointerCancel = (event: PointerEvent): void => {
      if (event.pointerId !== drag.pointerId) return;
      drag.cancel();
      releaseVisualState();
    };
    const onWheel = (event: WheelEvent): void => {
      if (drag.status !== "pointer") return;
      event.preventDefault();
      drag.rotate(event.deltaY >= 0 ? "clockwise" : "counterclockwise");
      updateTarget();
    };
    const onContextMenu = (event: MouseEvent): void => {
      if (drag.status !== "pointer") return;
      event.preventDefault();
      drag.rotate();
      updateTarget();
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        drag.cancel();
        releaseVisualState();
        return;
      }
      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        drag.rotate();
        if (drag.status === "pointer") updateTarget();
        return;
      }
      if (drag.status !== "keyboard") return;
      const movement: Partial<Record<string, readonly [number, number]>> = {
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
      };
      const delta = movement[event.key];
      if (delta) {
        event.preventDefault();
        drag.moveKeyboard(...delta);
      } else if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        drag.commit();
        releaseVisualState();
      }
    };

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp, { passive: false });
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("contextmenu", onContextMenu);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("wheel", onWheel);
      document.removeEventListener("contextmenu", onContextMenu);
      releaseVisualState();
    };
  }, [drag, drag.status, findPointerTarget]);

  const startPointerDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    ship: DraftShip,
  ): void => {
    const rect = event.currentTarget.getBoundingClientRect();
    const distance =
      ship.orientation === "horizontal"
        ? event.clientX - rect.left
        : event.clientY - rect.top;
    const segment = Math.min(
      ship.length - 1,
      Math.max(0, Math.floor(distance / cellSize)),
    );
    if (drag.beginPointer(ship.id, segment, event.nativeEvent, cellSize)) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      capturedElement.current = event.currentTarget;
      capturedPointerId.current = event.pointerId;
      findPointerTarget();
    }
  };

  const startKeyboardDrag = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    ship: DraftShip,
  ): void => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    drag.beginKeyboard(ship.id, cellSize);
  };

  const placed = store.ships.filter(
    (
      ship,
    ): ship is DraftShip & { placement: NonNullable<DraftShip["placement"]> } =>
      ship.placement !== null,
  );
  const suggestion = drag.suggestion;
  const cloneShip = drag.activeShip;
  const cloneRectangle = drag.cloneRectangle;
  const cloneStyle: CloneStyle | undefined =
    cloneShip && cloneRectangle
      ? {
          position: "fixed",
          pointerEvents: "none",
          ...cloneRectangle,
          "--rotation-angle": `${drag.rotationDegrees}deg`,
        }
      : undefined;

  return (
    <div className="placement-geometry flex min-w-max flex-row items-start justify-center gap-4">
      <div
        ref={boardRef}
        role="grid"
        aria-label="Fleet placement board"
        className="legacy-grid"
        style={gridStyle(store.rules.rows, store.rules.columns)}
      >
        {Array.from(
          { length: store.rules.rows * store.rules.columns },
          (_, index) => {
            const row = Math.floor(index / store.rules.columns);
            const column = index % store.rules.columns;
            return (
              <div
                key={index}
                role="gridcell"
                aria-label={`${String.fromCharCode(65 + column)}${row + 1}`}
                className="legacy-cell bg-battle-cell"
                style={{ gridRow: row + 1, gridColumn: column + 1 }}
              />
            );
          },
        )}

        {suggestion && drag.suggestionLegal && (
          <div
            aria-hidden="true"
            className="legacy-ship border-suggestion-border bg-suggestion pointer-events-none z-30 opacity-70"
            style={shipStyle(
              {
                length: suggestion.length,
                orientation: suggestion.orientation,
              },
              suggestion.headRow,
              suggestion.headColumn,
            )}
          />
        )}

        {placed.map((ship) => (
          <ShipButton
            key={ship.id}
            ship={ship}
            row={ship.placement.headRow}
            column={ship.placement.headColumn}
            source="board"
            dimmed={drag.activeShipId === ship.id}
            locked={store.locked}
            onPointerDown={startPointerDrag}
            onKeyDown={startKeyboardDrag}
          />
        ))}
      </div>

      <div
        ref={garageRef}
        role="grid"
        aria-label="Ship garage"
        className={cn(
          "legacy-grid",
          drag.overGarage && drag.suggestionLegal && "ring-suggestion ring-4",
        )}
        style={gridStyle(
          store.ships.length,
          Math.max(...store.rules.fleetLengths),
        )}
      >
        {Array.from(
          {
            length: store.ships.length * Math.max(...store.rules.fleetLengths),
          },
          (_, index) => {
            const columns = Math.max(...store.rules.fleetLengths);
            return (
              <div
                key={index}
                role="gridcell"
                className="legacy-cell bg-garage-cell"
                style={{
                  gridRow: Math.floor(index / columns) + 1,
                  gridColumn: (index % columns) + 1,
                }}
              />
            );
          },
        )}
        {store.garageShips.map((ship, row) => (
          <ShipButton
            key={ship.id}
            ship={ship}
            row={row}
            column={0}
            source="garage"
            dimmed={drag.activeShipId === ship.id}
            locked={store.locked}
            onPointerDown={startPointerDrag}
            onKeyDown={startKeyboardDrag}
          />
        ))}
      </div>

      {cloneShip && cloneStyle && drag.status === "pointer" && (
        <div
          aria-hidden="true"
          className="legacy-ship drag-clone pointer-events-none z-[1000] opacity-95 shadow-[0_4px_12px_rgb(0_0_0/0.2)]"
          style={cloneStyle}
        />
      )}

      {drag.status === "pointer" && drag.pointerType === "touch" && (
        <Button
          className="fixed bottom-5 left-4 z-[1100] touch-none shadow-lg"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            drag.rotate();
            findPointerTarget();
          }}
        >
          Rotate
        </Button>
      )}

      <p className="sr-only" aria-live="assertive" aria-atomic="true">
        {drag.announcement}
      </p>
    </div>
  );
});
