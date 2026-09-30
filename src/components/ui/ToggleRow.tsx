import { SwitchState, SwitchTrack } from './Switch';

interface Props {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

/**
 * A settings row that is one big switch: the words on the left, the switch and
 * "On" / "Off" on the right. The whole row is the target, not just the pill.
 */
export function ToggleRow({ label, desc, checked, onChange, disabled }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-4 p-3 rounded-md hover:bg-secondary/40 text-left transition focus-ring disabled:opacity-50 disabled:pointer-events-none"
    >
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {desc && <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>}
      </div>
      <span className="flex items-center gap-2 shrink-0">
        <SwitchTrack checked={checked} />
        <SwitchState checked={checked} />
      </span>
    </button>
  );
}
