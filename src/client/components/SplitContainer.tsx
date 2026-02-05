import type { LayoutNode } from "../../shared/types";
import { Terminal } from "./Terminal";

interface SplitContainerProps {
  node: LayoutNode;
  wsRef: React.RefObject<WebSocket | null>;
}

/**
 * SplitContainer recursively renders the layout tree.
 * - Leaf nodes render a Terminal component
 * - Split nodes render a flex container with children
 */
export function SplitContainer({ node, wsRef }: SplitContainerProps) {
  if (node.type === "leaf") {
    return (
      <div className="split-leaf">
        <Terminal paneId={node.paneId} wsRef={wsRef} />
      </div>
    );
  }

  // Split node: render children in a flex container
  const isHorizontal = node.direction === "horizontal";

  return (
    <div
      className="split-container"
      style={{
        flexDirection: isHorizontal ? "column" : "row",
      }}
    >
      {node.children.map((child, index) => {
        const size = node.sizes[index] ?? 1 / node.children.length;
        const childKey =
          child.type === "leaf" ? child.paneId : `split-${index}`;

        return (
          <div
            key={childKey}
            className="split-child"
            style={{
              flex: `${size} ${size} 0%`,
            }}
          >
            <SplitContainer node={child} wsRef={wsRef} />
          </div>
        );
      })}
    </div>
  );
}
