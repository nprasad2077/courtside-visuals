import type { CSSProperties, ReactNode } from "react";

interface Props {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  style?: CSSProperties;
  valueStyle?: CSSProperties;
}

export function StatTile({ label, value, sub, style, valueStyle }: Props) {
  return (
    <div className="tile" style={style}>
      <div className="tile-label">{label}</div>
      <div className="tile-value" style={valueStyle}>
        {value}
      </div>
      {sub != null && <div className="tile-sub">{sub}</div>}
    </div>
  );
}
