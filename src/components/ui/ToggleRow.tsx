import { cn } from '@/lib/utils';

interface Props {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

export function ToggleRow({ label, desc, checked, onChange }: Props) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between p-3 rounded-md hover:bg-secondary/40 text-left transition"
    >
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {desc && <div className="text-[11px] text-muted-foreground">{desc}</div>}
      </div>
      <span
        className={cn(
          'relative inline-block w-9 h-5 rounded-full transition shrink-0',
          checked ? 'bg-primary' : 'bg-muted',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-4 rounded-full bg-white transition',
            checked ? 'left-[18px]' : 'left-0.5',
          )}
        />
      </span>
    </button>
  );
}
