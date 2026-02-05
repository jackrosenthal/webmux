import type { LayoutNode, LayoutSplit } from "../../shared/types";
import { Terminal } from "./Terminal";
import { ResizeHandle } from "./ResizeHandle";

interface SplitContainerProps {
  node: LayoutNode;
  wsRef: React.RefObject<WebSocket | null>;
  /** Called when a resize handle is dragged (to be implemented in 8.2) */
  onResize?: (
    splitNode: LayoutSplit,
    handleIndex: number,
    delta: number
  ) => void;
}

/**
 * SplitContainer recursively renders the layout tree.
 * - Leaf nodes render a Terminal component
 * - Split nodes render a flex container with children and resize handles
 */
export function SplitContainer({ node, wsRef, onResize }: SplitContainerProps) {
  if (node.type === "leaf") {
    return (
      <div className="split-leaf">
        <Terminal paneId={node.paneId} wsRef={wsRef} />
      </div>
    );
  }

  // Split node: render children in a flex container with resize handles between them
  const isHorizontal = node.direction === "horizontal";

  const handleResizeStart = (handleIndex: number) => {
    // Resize start handling will be implemented in 8.2
    // For now, just log the event
    console.log(`Resize started: handle ${handleIndex} in ${node.direction} split`);
  };

  // Build interleaved children and handles
  const elements: React.ReactNode[] = [];

  node.children.forEach((child, index) => {
    const size = node.sizes[index] ?? 1 / node.children.length;
    const childKey =
      child.type === "leaf" ? child.paneId : `split-${index}`;

    elements.push(
      <div
        key={childKey}
        className="split-child"
        style={{
          flex: `${size} ${size} 0%`,
        }}
      >
        <SplitContainer node={child} wsRef={wsRef} onResize={onResize} />
      </div>
    );

    // Add resize handle after each child except the last
    if (index < node.children.length - 1) {
      elements.push(
        <ResizeHandle
          key={`handle-${index}`}
          direction={node.direction}
          index={index}
          onResizeStart={handleResizeStart}
        />
      );
    }
  });

  return (
    <div
      className="split-container"
      style={{
        flexDirection: isHorizontal ? "column" : "row",
      }}
    >
      {elements}
    </div>
  );
}
