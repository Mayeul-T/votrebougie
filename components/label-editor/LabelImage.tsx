"use client";

import { useEffect, useRef, useState } from "react";
import { Image as KonvaImage } from "react-konva";
import type { ImageElement } from "./types";

/** Charge une image HTML depuis une URL (objectURL local) pour Konva. */
function useHtmlImage(src: string, onLoad: () => void) {
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

export default function LabelImage({
  element,
  onSelect,
  onChange,
  onLoaded,
}: {
  element: ImageElement;
  onSelect: () => void;
  onChange: (element: ImageElement) => void;
  /** Signale la fin du décodage : l'export débouncé doit être refait. */
  onLoaded: () => void;
}) {
  const img = useHtmlImage(element.src, onLoaded);

  return (
    <KonvaImage
      id={element.id}
      image={img ?? undefined}
      x={element.x}
      y={element.y}
      width={element.width}
      height={element.height}
      rotation={element.rotation}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) =>
        onChange({ ...element, x: e.target.x(), y: e.target.y() })
      }
      onTransformEnd={(e) => {
        // Le Transformer applique un scale : on le cuit dans width/height
        // pour garder un modèle sans facteur d'échelle.
        const node = e.target;
        const width = Math.max(8, node.width() * node.scaleX());
        const height = Math.max(8, node.height() * node.scaleY());
        node.scaleX(1);
        node.scaleY(1);
        onChange({
          ...element,
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          width,
          height,
        });
      }}
    />
  );
}
