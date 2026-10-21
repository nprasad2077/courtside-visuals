/**
 * Fold a string for accent-insensitive matching, keeping a map from each folded
 * character back to its index in the original ("Jokić" → "jokic", map [0,1,2,3,4]).
 * Folding one character can yield zero or several characters, which is why the map is needed.
 */
export function fold(s: string): { text: string; map: number[] } {
  let text = "";
  const map: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const f = s[i].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    for (const ch of f) {
      text += ch;
      map.push(i);
    }
  }
  return { text, map };
}

/** Split a name around the first accent-insensitive match: [before, match, after], or null. */
export function highlight(name: string, q: string): [string, string, string] | null {
  const needle = fold(q.trim()).text;
  if (!needle) return null;
  const { text, map } = fold(name);
  const at = text.indexOf(needle);
  if (at < 0) return null;
  const start = map[at];
  const end = map[at + needle.length - 1] + 1;
  return [name.slice(0, start), name.slice(start, end), name.slice(end)];
}
