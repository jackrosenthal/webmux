interface PaneTitleBarProps {
  title: string;
}

/**
 * PaneTitleBar displays the title of a terminal pane.
 * The title comes from terminal escape sequences (OSC 0/1/2) or defaults to the shell name.
 */
export function PaneTitleBar({ title }: PaneTitleBarProps) {
  return (
    <div className="pane-title-bar">
      <span className="pane-title">{title}</span>
    </div>
  );
}
