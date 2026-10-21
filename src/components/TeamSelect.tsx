import { useMeta } from "../lib/api";

interface Props {
  value: string;
  onChange: (abbr: string) => void;
  label: string;
}

export function TeamSelect({ value, onChange, label }: Props) {
  const { data } = useMeta();
  return (
    <select className="pill-select" value={value} aria-label={label} onChange={(e) => onChange(e.target.value)}>
      {(data?.teams ?? [{ abbr: value, name: "" }]).map((t) => (
        <option key={t.abbr} value={t.abbr}>
          {t.abbr} · {t.name}
        </option>
      ))}
    </select>
  );
}
