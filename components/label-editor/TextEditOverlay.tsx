"use client";

import type Konva from "konva";
import { useRef } from "react";
import type { TextElement } from "./types";

/**
 * Textarea superposé au texte Konva pendant l'édition (double-clic).
 * Entrée insère un retour à la ligne (multiligne) ; un clic à l'extérieur
 * (blur) valide ; Échap annule. PoC : le textarea approxime les métriques
 * texte de Konva, une légère dérive pendant la frappe est acceptée.
 */
export default function TextEditOverlay({
  element,
  node,
  displayScale,
  onLiveChange,
  onCommit,
  onCancel,
}: {
  element: TextElement;
  /** Nœud Konva du texte en édition, pour caler position et dimensions. */
  node: Konva.Text | undefined;
  displayScale: number;
  /** Appelé à chaque frappe : le visuel de la bougie suit en direct. */
  onLiveChange: (value: string) => void;
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
        if (e.key === "Escape") {
          skipCommitRef.current = true;
          e.currentTarget.blur();
        }
      }}
      onInput={(e) => {
        // Le textarea grandit avec le contenu multiligne.
        e.currentTarget.style.height = "auto";
        e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
        onLiveChange(e.currentTarget.value);
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
          (element.width ??
            Math.max(node?.width() ?? 0, element.fontSize * 6)) * displayScale,
        height: ((node?.height() ?? element.fontSize) + 4) * displayScale,
        fontSize: element.fontSize * displayScale,
        lineHeight: 1,
        fontFamily: element.fontFamily,
        fontWeight: element.bold ? "bold" : "normal",
        fontStyle: element.italic ? "italic" : "normal",
        textDecoration: element.underline ? "underline" : "none",
        textAlign: element.align,
        color: element.fill,
        transform: `rotate(${element.rotation}deg)`,
        transformOrigin: "top left",
      }}
    />
  );
}
