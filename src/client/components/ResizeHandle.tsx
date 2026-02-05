import type { SplitDirection } from "../../shared/types";

interface ResizeHandleProps {
  direction: SplitDirection;
  /** Index of the resize handle (between child index and index+1) */
  index: number;
  /** Called when drag starts */
  onResizeStart: (index: number) => void;
}

/**
 * Draggable handle between split panes.
 * Direction determines whether the handle is horizontal (between stacked panes)
 * or vertical (between side-by-side panes).
 */
export function ResizeHandle({
  direction,
  index,
  onResizeStart,
}: ResizeHandleProps) {
  const isHorizontal = direction === "horizontal";

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    onResizeStart(index);
  };

  return (
    <div
      className={`resize-handle ${isHorizontal ? "resize-handle-horizontal" : "resize-handle-vertical"}`}
      onMouseDown={handleMouseDown}
    />
  );
}
