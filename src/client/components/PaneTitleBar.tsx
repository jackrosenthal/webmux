import { IconColumns2, IconLayoutRows, IconX } from "@tabler/icons-react";

interface PaneTitleBarProps {
  title: string;
  focused?: boolean;
  onVSplit?: () => void;
  onHSplit?: () => void;
  onClose?: () => void;
}

/**
 * PaneTitleBar displays the title of a terminal pane with split and close buttons.
 * The title comes from terminal escape sequences (OSC 0/1/2) or defaults to the shell name.
 */
export function PaneTitleBar({
  title,
  focused,
  onVSplit,
  onHSplit,
  onClose,
}: PaneTitleBarProps) {
  const className = focused
    ? "pane-title-bar pane-title-bar-focused"
    : "pane-title-bar";
  return (
    <div className={className}>
      <span className="pane-title">{title}</span>
      <div className="pane-title-buttons">
        {onVSplit && (
          <button
            className="pane-title-button"
            onClick={onVSplit}
            title="Split vertically"
          >
            <IconColumns2 size={14} stroke={1.5} />
          </button>
        )}
        {onHSplit && (
          <button
            className="pane-title-button"
            onClick={onHSplit}
            title="Split horizontally"
          >
            <IconLayoutRows size={14} stroke={1.5} />
          </button>
        )}
        {onClose && (
          <button
            className="pane-title-button pane-close-button"
            onClick={onClose}
            title="Close pane"
          >
            <IconX size={14} stroke={1.5} />
          </button>
        )}
      </div>
    </div>
  );
}
