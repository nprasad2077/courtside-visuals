import type { ReactNode } from "react";

interface Props {
  id: string;
  caption: string;
  width?: number;
  /** Take the whole row instead of a fixed width. */
  wide?: boolean;
  kicker: string;
  title: ReactNode;
  sub?: ReactNode;
  controls?: ReactNode;
  children: ReactNode;
  gap?: number;
  onMouseLeave?: () => void;
}

export function Card({ id, caption, width, wide, kicker, title, sub, controls, children, gap, onMouseLeave }: Props) {
  return (
    <section className="opt" id={id} aria-labelledby={`${id}-title`} style={wide ? { flex: "1 1 100%" } : undefined}>
      <div className="opt-label">
        <a className="opt-id" href={`#${id}`}>
          {id}
        </a>
        {caption}
      </div>
      <div className="vcard" style={{ width: wide ? "100%" : width, gap }} onMouseLeave={onMouseLeave}>
        <div className="vcard-head">
          <div className="vcard-titles">
            <div className="kicker">{kicker}</div>
            <h2 className="vcard-title" id={`${id}-title`} style={{ margin: 0 }}>
              {title}
            </h2>
            {sub && <div className="vcard-sub">{sub}</div>}
          </div>
          {controls && <div className="vcard-controls">{controls}</div>}
        </div>
        {children}
      </div>
    </section>
  );
}
