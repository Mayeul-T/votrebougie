"use client";

import { useEffect } from "react";

/**
 * Déclenche `onDelete` sur Suppr/Retour arrière. C'est au callback de se
 * neutraliser quand une saisie est en cours (édition de texte).
 */
export default function useDeleteKey(onDelete: () => void) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") onDelete();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onDelete]);
}
