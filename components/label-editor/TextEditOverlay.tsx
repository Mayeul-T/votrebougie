"use client";

import type Konva from "konva";
import { useRef } from "react";
import { LABEL_FONT_FAMILY, type TextElement } from "./types";

/**
 * Textarea superposé au texte Konva pendant l'édition (double-clic).
 * PoC : il approxime les métriques texte de Konva, une légère dérive
 * visuelle pendant la frappe est acceptée.
 */
export default function TextEditOverlay({
  element,
  node,
  displayScale,
  onCommit,
  onCancel,
}: {
  element: TextElement;
  /** Nœud Konva du texte en édition, pour caler position et dimensions. */
  node: Konva.Text | undefined;
  displayScale: number;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const skipCommitRef = useRef(false);

  return (
    <textarea
      // biome-ignore lint/a11y/noAutofocus: l'édition vient d'être demandée au double-clic
      autoFocus
      defaultValue={element.text}
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          skipCommitRef.current = true;
          e.currentTarget.blur();
        }
      }}
      onBlur={(e) => {
        const skip = skipCommitRef.current;
        skipCommitRef.current = false;
        if (skip) onCancel();
        else onCommit(e.currentTarget.value);
      }}
      className="absolute m-0 resize-none overflow-hidden border-none bg-transparent p-0 outline-none"
      style={{
        top: element.y * displayScale,
        left: element.x * displayScale,
        width:
          Math.max(node?.width() ?? 0, element.fontSize * 6) * displayScale,
        height: ((node?.height() ?? element.fontSize) + 4) * displayScale,
        fontSize: element.fontSize * displayScale,
        lineHeight: 1,
        fontFamily: LABEL_FONT_FAMILY,
        color: element.fill,
        transform: `rotate(${element.rotation}deg)`,
        transformOrigin: "top left",
      }}
    />
  );
}
