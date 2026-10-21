import { useReducedMotion } from "motion/react";

/** The one easing curve used everywhere. */
export const EASE: [number, number, number, number] = [0.3, 0.7, 0.2, 1];
export const EASE_CSS = "cubic-bezier(.3,.7,.2,1)";

/** Seconds → seconds, or 0 when the user prefers reduced motion. */
export function useDuration() {
  const reduce = useReducedMotion();
  return (s: number) => (reduce ? 0 : s);
}

/** CSS transition string that collapses to "none" under reduced motion. */
export function useTransition() {
  const reduce = useReducedMotion();
  return (props: string, s = 0.5, ease = EASE_CSS) =>
    reduce ? "none" : props.split(",").map((p) => `${p.trim()} ${s}s ${ease}`).join(",");
}
