"use client";

import { useEffect } from "react";

/**
 * Déclenche `onDelete` sur Suppr/Retour arrière — sauf quand la frappe a
 * lieu dans un champ de saisie (textarea d'édition, taille de police…).
 */
export default function useDeleteKey(onDelete: () => void) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      onDelete();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onDelete]);
}
