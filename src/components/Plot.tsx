import type { CSSProperties, ReactNode } from "react";

/**
 * An SVG with an HTML overlay. Text is kept out of the SVG and positioned by percentage
 * of the viewBox, so it scales with the chart and stays crisp.
 */
export function Plot({
  w,
  h,
  children,
  labels,
  style,
  svgProps,
}: {
  w: number;
  h: number;
  children: ReactNode;
  labels?: ReactNode;
  style?: CSSProperties;
  svgProps?: React.SVGProps<SVGSVGElement>;
}) {
  return (
    <div className="plot" style={style}>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" {...svgProps}>
        {children}
      </svg>
      {labels}
    </div>
  );
}

type AnchorX = "start" | "middle" | "end";
type AnchorY = "top" | "middle" | "bottom";
const TX: Record<AnchorX, string> = { start: "0", middle: "-50%", end: "-100%" };
const TY: Record<AnchorY, string> = { top: "0", middle: "-50%", bottom: "-100%" };

export function Lab({
  x,
  y,
  w,
  h,
  ax = "start",
  ay = "middle",
  halo,
  className = "",
  style,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  ax?: AnchorX;
  ay?: AnchorY;
  halo?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      className={`lab ${halo ? "halo" : ""} ${className}`}
      style={{
        left: `${(x / w) * 100}%`,
        top: `${(y / h) * 100}%`,
        transform: `translate(${TX[ax]}, ${TY[ay]})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
