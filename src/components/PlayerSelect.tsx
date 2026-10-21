import { usePlayersWithShots } from "../lib/api";

interface Props {
  value: string;
  onChange: (id: string) => void;
}

/** Only for the shot-based cards (1a, 1j): the shots table covers a fixed set of players. */
export function PlayerSelect({ value, onChange }: Props) {
  const { data = [] } = usePlayersWithShots();
  return (
    <select className="pill-select" value={value} aria-label="Player" onChange={(e) => onChange(e.target.value)}>
      {data.length === 0 && <option value={value}>Loading…</option>}
      {data.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
