interface PaneTitleBarProps {
  title: string;
  onClose?: () => void;
}

/**
 * PaneTitleBar displays the title of a terminal pane with a close button.
 * The title comes from terminal escape sequences (OSC 0/1/2) or defaults to the shell name.
 */
export function PaneTitleBar({ title, onClose }: PaneTitleBarProps) {
  return (
    <div className="pane-title-bar">
      <span className="pane-title">{title}</span>
      {onClose && (
        <button
          className="pane-close-button"
          onClick={onClose}
          title="Close pane"
        >
          ×
        </button>
      )}
    </div>
  );
}
