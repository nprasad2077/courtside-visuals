import { autoUpdate, flip, FloatingPortal, offset, shift, useFloating } from "@floating-ui/react";
import { useCallback, useLayoutEffect, useState, type ReactNode } from "react";

interface TipState {
  x: number;
  y: number;
  content: ReactNode;
}

/**
 * Cursor-anchored tooltip. The reference is a zero-size virtual element at the pointer,
 * so floating-ui's flip/shift keep the box on screen and off the cursor.
 */
export function useChartTooltip() {
  const [tip, setTip] = useState<TipState | null>(null);
  const { refs, floatingStyles } = useFloating({
    open: !!tip,
    placement: "top",
    strategy: "fixed",
    middleware: [offset(12), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  useLayoutEffect(() => {
    if (!tip) return;
    const { x, y } = tip;
    refs.setPositionReference({
      getBoundingClientRect: () => ({ x, y, left: x, top: y, right: x, bottom: y, width: 0, height: 0 }),
    });
  }, [tip, refs]);

  const show = useCallback((e: { clientX: number; clientY: number }, content: ReactNode) => {
    setTip({ x: e.clientX, y: e.clientY, content });
  }, []);
  const hide = useCallback(() => setTip(null), []);

  const node = tip ? (
    <FloatingPortal>
      <div ref={refs.setFloating} className="tip" role="tooltip" style={floatingStyles}>
        {tip.content}
      </div>
    </FloatingPortal>
  ) : null;

  return { show, hide, node };
}

export function Tip({ title, rows }: { title: ReactNode; rows: [ReactNode, ReactNode][] }) {
  return (
    <>
      <div className="tip-title">{title}</div>
      {rows.map(([k, v], i) => (
        <div className="tip-row" key={i}>
          <span>{k}</span>
          <span>{v}</span>
        </div>
      ))}
    </>
  );
}
