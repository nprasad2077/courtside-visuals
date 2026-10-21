import { animate } from "motion";
import { interpolatePath } from "d3-interpolate-path";
import { useLayoutEffect, useRef, type SVGProps } from "react";
import { EASE, useDuration } from "../lib/motion";

/**
 * A <path> whose `d` morphs from what's on screen to the new value.
 * The layout effect runs before paint, so the first frame shows the old shape, not a jump.
 * Starting from the element's current attribute means an interrupted morph continues smoothly.
 */
export function MorphPath({ d, duration = 0.7, ...rest }: Omit<SVGProps<SVGPathElement>, "ref"> & { d: string; duration?: number }) {
  const ref = useRef<SVGPathElement>(null);
  const dur = useDuration();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = el.dataset.d ?? d;
    el.dataset.d = d;
    if (from === d || !from) {
      el.setAttribute("d", d);
      return;
    }
    const interp = interpolatePath(from, d);
    el.setAttribute("d", from);
    const controls = animate(0, 1, {
      duration: dur(duration),
      ease: EASE,
      onUpdate: (t) => {
        const cur = interp(t);
        el.setAttribute("d", cur);
        el.dataset.d = cur;
      },
      onComplete: () => {
        el.setAttribute("d", d);
        el.dataset.d = d;
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d]);
  return <path ref={ref} {...rest} />;
}
