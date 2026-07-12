"use client";

import { type RefObject, useEffect, useState } from "react";

/**
 * Échelle d'affichage de l'éditeur : le Stage suit la largeur de son
 * conteneur, mais les coordonnées des éléments restent en pixels de base.
 */
export default function useDisplayScale(
  containerRef: RefObject<HTMLDivElement | null>,
  baseWidth: number,
) {
  const [displayScale, setDisplayScale] = useState(1);

  useEffect(() => {
    const wrap = containerRef.current;
    if (!wrap) return;
    const measure = () => {
      if (wrap.clientWidth > 0) setDisplayScale(wrap.clientWidth / baseWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [containerRef, baseWidth]);

  return displayScale;
}
