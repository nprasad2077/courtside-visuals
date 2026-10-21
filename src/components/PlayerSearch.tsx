import { useCombobox } from "downshift";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePlayerSearch, type Player, type Stint } from "../lib/api";
import { highlight } from "../lib/search";

interface Props {
  /** The selected player in "pick" mode. Ignored in "add" mode. */
  value?: { id: string; name: string } | null;
  /**
   * `season` is set when the pick came from a team stint: the card should jump there.
   * Plain picks leave the card's season alone (it stays put if the player has it).
   */
  onSelect: (p: Player, season?: number) => void;
  /** The season the card is showing, so the matching stint can be emphasized. */
  season?: number;
  /** "add" clears after each pick and hides already-picked ids (1h). */
  mode?: "pick" | "add";
  excludeIds?: string[];
  align?: "left" | "right";
  width?: number | string;
  label?: string;
  placeholder?: string;
}

function useDebounced<T>(v: T, ms: number): T {
  const [out, setOut] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setOut(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return out;
}

const yy = (y: number) => String(y % 100).padStart(2, "0");
const covers = (s: Stint, season: number | undefined) => season != null && s.from <= season && season <= s.to;

export function PlayerSearch({
  value,
  onSelect,
  mode = "pick",
  excludeIds = [],
  align = "left",
  width = 220,
  label = "Search players",
  placeholder = "Search players",
  season,
}: Props) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const q = useDebounced(query, 120);
  const { data: items = [], isFetching } = usePlayerSearch(q, excludeIds, focused);
  const shown = focused ? items : [];

  const cb = useCombobox<Player>({
    items: shown,
    itemToString: (p) => p?.name ?? "",
    inputValue: focused ? query : mode === "add" ? "" : value?.name ?? "",
    selectedItem: null,
    onInputValueChange: ({ inputValue, type }) => {
      if (type === useCombobox.stateChangeTypes.InputChange) setQuery(inputValue ?? "");
    },
    onSelectedItemChange: ({ selectedItem }) => {
      if (!selectedItem) return;
      onSelect(selectedItem);
      setQuery("");
      if (mode === "pick") inputRef.current?.blur();
    },
    stateReducer: (_state, { type, changes }) => {
      // Keep the menu open after a pick in add mode so several players can be added in a row.
      if (mode === "add" && (type === useCombobox.stateChangeTypes.ItemClick || type === useCombobox.stateChangeTypes.InputKeyDownEnter)) {
        return { ...changes, isOpen: true, highlightedIndex: changes.highlightedIndex };
      }
      return changes;
    },
  });

  const pickStint = (p: Player, st: Stint) => {
    onSelect(p, covers(st, season) ? season : st.to);
    setQuery("");
    inputRef.current?.blur();
  };

  const ph = focused && mode === "pick" && value ? value.name : placeholder;
  const settled = q === query && !isFetching;

  return (
    <div className="search" style={{ width, maxWidth: "100%" }}>
      <label {...cb.getLabelProps()} className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
        {label}
      </label>
      <div className="search-box">
        <Search size={14} strokeWidth={2.75} color="#645c50" style={{ flex: "none" }} aria-hidden />
        <input
          {...cb.getInputProps({
            ref: inputRef,
            placeholder: ph,
            spellCheck: false,
            autoComplete: "off",
            onFocus: () => {
              setFocused(true);
              setQuery("");
              cb.openMenu();
            },
            onBlur: () => setFocused(false),
          })}
        />
      </div>
      <ul {...cb.getMenuProps()} className={`search-menu ${align}`} style={{ display: cb.isOpen && focused ? "block" : "none" }}>
        {cb.isOpen &&
          focused &&
          shown.map((p, i) => {
            const parts = highlight(p.name, query);
            // Older cached responses (max-age=3600) predate stints.
            const stints = p.stints ?? [];
            return (
              <li
                key={p.id}
                {...cb.getItemProps({ item: p, index: i })}
                className="search-item"
                data-highlighted={cb.highlightedIndex === i}
                data-selected={mode === "pick" && value?.id === p.id}
              >
                <div className="search-item-main">
                  <span className="dot" style={{ background: (stints.find((st) => covers(st, season)) ?? p).color }} />
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {parts ? (
                      <>
                        {parts[0]}
                        <mark>{parts[1]}</mark>
                        {parts[2]}
                      </>
                    ) : (
                      p.name
                    )}
                  </span>
                  <span className="meta">
                    {p.firstSeason}–{yy(p.lastSeason + 1)}
                  </span>
                </div>
                <div className="stints">
                  {stints.map((st, k) => {
                    const on = covers(st, season);
                    const text = `${st.team} ${yy(st.from)}–${yy(st.to + 1)}`;
                    return mode === "pick" ? (
                      <span
                        key={k}
                        className="stint"
                        data-on={on}
                        title={`${p.name} with ${st.team}: ${st.gp} games. Click to jump to ${on ? "this season" : `${st.to}–${yy(st.to + 1)}`}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          pickStint(p, st);
                        }}
                      >
                        <i style={{ background: st.color }} />
                        {text}
                      </span>
                    ) : (
                      <span key={k} className="stint" data-on={on}>
                        <i style={{ background: st.color }} />
                        {text}
                      </span>
                    );
                  })}
                </div>
              </li>
            );
          })}
        {cb.isOpen && focused && settled && shown.length === 0 && (
          <li className="search-empty">No player matches “{query}”</li>
        )}
        {cb.isOpen && focused && <li className="search-hint" aria-hidden>
            ↑↓ to move · Enter to pick{mode === "pick" ? " · click a team to jump to its seasons" : ""} · Esc to close
          </li>}
      </ul>
    </div>
  );
}
