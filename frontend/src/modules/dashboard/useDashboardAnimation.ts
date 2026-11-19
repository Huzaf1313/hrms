import { useEffect, useState } from "react";

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Counts up to `target` once the component mounts, so dashboard figures read
 * as animated rather than snapping into place. Honours reduced-motion by
 * jumping straight to the final value.
 */
export function useCountUp(target: number, duration = 1400): number {
  const [value, setValue] = useState(() =>
    prefersReducedMotion() ? target : 0,
  );

  useEffect(() => {
    if (prefersReducedMotion()) {
      const frame = requestAnimationFrame(() => setValue(target));

      return () => cancelAnimationFrame(frame);
    }

    let frame: number | null = null;
    let start: number | null = null;

    const step = (timestamp: number) => {
      if (start === null) {
        start = timestamp;
      }

      const progress = Math.min((timestamp - start) / duration, 1);

      // easeOutCubic keeps the movement quick at the start and soft at the end.
      const eased = 1 - Math.pow(1 - progress, 3);

      setValue(target * eased);

      if (progress < 1) {
        frame = requestAnimationFrame(step);
      }
    };

    frame = requestAnimationFrame(step);

    return () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    };
  }, [target, duration]);

  return value;
}

/**
 * Flips to true one frame after mount. Used to drive width/offset transitions:
 * the element first renders at its resting value, then transitions to the
 * real one.
 */
export function useAnimationFrame(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));

    return () => cancelAnimationFrame(frame);
  }, []);

  return ready;
}