import type { SplitDirection } from "../../shared/types";

interface ResizeHandleProps {
  direction: SplitDirection;
  /** Index of the resize handle (between child index and index+1) */
  index: number;
  /** Called when drag starts - receives the mouse event */
  onResizeStart: (e: React.MouseEvent) => void;
}

/**
 * Draggable handle between split panes.
 * Direction determines whether the handle is horizontal (between stacked panes)
 * or vertical (between side-by-side panes).
 */
export function ResizeHandle({
  direction,
  index: _index,
  onResizeStart,
}: ResizeHandleProps) {
  const isHorizontal = direction === "horizontal";

  return (
    <div
      className={`resize-handle ${isHorizontal ? "resize-handle-horizontal" : "resize-handle-vertical"}`}
      onMouseDown={onResizeStart}
    />
  );
}
