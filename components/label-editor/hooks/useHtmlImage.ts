"use client";

import { useEffect, useRef, useState } from "react";

/** Charge une image HTML depuis une URL (objectURL local) pour Konva. */
export default function useHtmlImage(src: string, onLoad: () => void) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;

  useEffect(() => {
    const el = new window.Image();
    el.onload = () => {
      setImg(el);
      onLoadRef.current();
    };
    el.src = src;
    return () => {
      el.onload = null;
    };
  }, [src]);

  return img;
}
