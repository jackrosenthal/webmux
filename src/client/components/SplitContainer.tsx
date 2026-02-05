import { useCallback, useEffect, useRef, useState } from "react";
import type { LayoutNode, LayoutSplit, Pane } from "../../shared/types";
import { Terminal } from "./Terminal";
import { ResizeHandle } from "./ResizeHandle";
import { PaneTitleBar } from "./PaneTitleBar";

interface SplitContainerProps {
  node: LayoutNode;
  wsRef: React.RefObject<WebSocket | null>;
  /** Pane data for looking up titles */
  panes: Record<string, Pane>;
  /** Called when resize completes with the new sizes */
  onResizeComplete?:
    | ((splitNode: LayoutSplit, newSizes: number[]) => void)
    | undefined;
}

/**
 * State for tracking an active resize operation.
 */
interface ResizeState {
  /** Index of the handle being dragged (between child index and index+1) */
  handleIndex: number;
  /** Starting mouse position (x for vertical split, y for horizontal) */
  startPosition: number;
  /** Original sizes at the start of the drag */
  originalSizes: number[];
  /** Container size in pixels at the start of the drag */
  containerSize: number;
}

/**
 * SplitContainer recursively renders the layout tree.
 * - Leaf nodes render a Terminal component with title bar
 * - Split nodes render a flex container with children and resize handles
 */
export function SplitContainer({
  node,
  wsRef,
  panes,
  onResizeComplete,
}: SplitContainerProps) {
  // For leaf nodes, render the title bar and terminal
  if (node.type === "leaf") {
    const pane = panes[node.paneId];
    const title = pane?.title ?? "Terminal";

    return (
      <div className="split-leaf">
        <PaneTitleBar title={title} />
        <div className="pane-terminal-container">
          <Terminal paneId={node.paneId} wsRef={wsRef} />
        </div>
      </div>
    );
  }

  // For split nodes, we need resize handling
  return (
    <SplitNode
      node={node}
      wsRef={wsRef}
      panes={panes}
      onResizeComplete={onResizeComplete}
    />
  );
}

/**
 * SplitNode handles the resize logic for a split container.
 * Separated from SplitContainer to use hooks at the split level.
 */
function SplitNode({
  node,
  wsRef,
  panes,
  onResizeComplete,
}: {
  node: LayoutSplit;
  wsRef: React.RefObject<WebSocket | null>;
  panes: Record<string, Pane>;
  onResizeComplete?:
    | ((splitNode: LayoutSplit, newSizes: number[]) => void)
    | undefined;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [localSizes, setLocalSizes] = useState<number[] | null>(null);

  const isHorizontal = node.direction === "horizontal";

  // Use local sizes during drag, otherwise use node sizes
  const sizes = localSizes ?? node.sizes;

  const handleResizeStart = useCallback(
    (handleIndex: number, startX: number, startY: number) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const containerSize = isHorizontal ? rect.height : rect.width;

      // Account for resize handles (4px each)
      const handleCount = node.children.length - 1;
      const handleTotalSize = handleCount * 4;
      const adjustedContainerSize = containerSize - handleTotalSize;

      setResizeState({
        handleIndex,
        startPosition: isHorizontal ? startY : startX,
        originalSizes: [...node.sizes],
        containerSize: adjustedContainerSize,
      });

      // Initialize local sizes from current node sizes
      setLocalSizes([...node.sizes]);
    },
    [isHorizontal, node.children.length, node.sizes]
  );

  // Handle mouse move during drag
  useEffect(() => {
    if (!resizeState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const currentPosition = isHorizontal ? e.clientY : e.clientX;
      const delta = currentPosition - resizeState.startPosition;
      const deltaRatio = delta / resizeState.containerSize;

      // Calculate new sizes for the two adjacent children
      const { handleIndex, originalSizes } = resizeState;
      const newSizes = [...originalSizes];

      // Adjust the sizes of the children on either side of the handle
      const minSize = 0.05; // Minimum 5% for each pane
      const leftOriginal = originalSizes[handleIndex] ?? 0.5;
      const rightOriginal = originalSizes[handleIndex + 1] ?? 0.5;
      let leftNewSize = leftOriginal + deltaRatio;
      let rightNewSize = rightOriginal - deltaRatio;

      // Clamp to minimum sizes
      if (leftNewSize < minSize) {
        const adjustment = minSize - leftNewSize;
        leftNewSize = minSize;
        rightNewSize -= adjustment;
      }
      if (rightNewSize < minSize) {
        const adjustment = minSize - rightNewSize;
        rightNewSize = minSize;
        leftNewSize -= adjustment;
      }

      // Final clamp after adjustments
      leftNewSize = Math.max(minSize, leftNewSize);
      rightNewSize = Math.max(minSize, rightNewSize);

      newSizes[handleIndex] = leftNewSize;
      newSizes[handleIndex + 1] = rightNewSize;

      setLocalSizes(newSizes);
    };

    const handleMouseUp = () => {
      if (localSizes && onResizeComplete) {
        onResizeComplete(node, localSizes);
      }
      setResizeState(null);
      setLocalSizes(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizeState, isHorizontal, localSizes, node, onResizeComplete]);

  // Add body class during resize to prevent text selection and show cursor
  useEffect(() => {
    if (resizeState) {
      document.body.classList.add(
        isHorizontal ? "resizing-horizontal" : "resizing-vertical"
      );
    } else {
      document.body.classList.remove("resizing-horizontal", "resizing-vertical");
    }

    return () => {
      document.body.classList.remove("resizing-horizontal", "resizing-vertical");
    };
  }, [resizeState, isHorizontal]);

  const onHandleMouseDown = useCallback(
    (handleIndex: number) => (e: React.MouseEvent) => {
      e.preventDefault();
      handleResizeStart(handleIndex, e.clientX, e.clientY);
    },
    [handleResizeStart]
  );

  // Build interleaved children and handles
  const elements: React.ReactNode[] = [];

  node.children.forEach((child, index) => {
    const size = sizes[index] ?? 1 / node.children.length;
    const childKey = child.type === "leaf" ? child.paneId : `split-${index}`;

    elements.push(
      <div
        key={childKey}
        className="split-child"
        style={{
          flex: `${size} ${size} 0%`,
        }}
      >
        <SplitContainer
          node={child}
          wsRef={wsRef}
          panes={panes}
          onResizeComplete={onResizeComplete}
        />
      </div>
    );

    // Add resize handle after each child except the last
    if (index < node.children.length - 1) {
      elements.push(
        <ResizeHandle
          key={`handle-${index}`}
          direction={node.direction}
          index={index}
          onResizeStart={onHandleMouseDown(index)}
        />
      );
    }
  });

  return (
    <div
      ref={containerRef}
      className="split-container"
      style={{
        flexDirection: isHorizontal ? "column" : "row",
      }}
    >
      {elements}
    </div>
  );
}
