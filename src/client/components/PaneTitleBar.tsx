interface PaneTitleBarProps {
  title: string;
  focused?: boolean;
  onClose?: () => void;
}

/**
 * PaneTitleBar displays the title of a terminal pane with a close button.
 * The title comes from terminal escape sequences (OSC 0/1/2) or defaults to the shell name.
 */
export function PaneTitleBar({ title, focused, onClose }: PaneTitleBarProps) {
  const className = focused ? "pane-title-bar pane-title-bar-focused" : "pane-title-bar";
  return (
    <div className={className}>
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
