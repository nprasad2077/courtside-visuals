export interface SegOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
  title?: string;
}

interface Props<T extends string> {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  size?: "md" | "sm";
  dim?: boolean;
}

export function Segmented<T extends string>({ options, value, onChange, label, size = "md", dim }: Props<T>) {
  return (
    <div className={`segm ${size}`} role="group" aria-label={label} style={{ opacity: dim ? 0.45 : 1 }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          disabled={o.disabled}
          title={o.title}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
