"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { ImageElement, LabelElement, TextElement } from "../types";

type DocumentAction =
  | { type: "add"; element: LabelElement }
  | { type: "update"; element: LabelElement }
  | { type: "remove"; id: string };

/**
 * Réducteur du « document » étiquette. Centraliser les mutations ici ouvre
 * la voie à un futur historique undo/redo et à la persistance (le state
 * est sérialisable ; les objectURLs vivent hors du modèle).
 */
function documentReducer(
  elements: LabelElement[],
  action: DocumentAction,
): LabelElement[] {
  switch (action.type) {
    case "add":
      return [...elements, action.element];
    case "update":
      return elements.map((el) =>
        el.id === action.element.id ? action.element : el,
      );
    case "remove":
      return elements.filter((el) => el.id !== action.id);
  }
}

/**
 * Le document de l'étiquette : la liste des éléments et ses opérations.
 * Possède aussi le cycle de vie des objectURLs des images importées.
 */
export default function useLabelDocument({
  baseWidth,
  baseHeight,
  onElementAdded,
}: {
  baseWidth: number;
  baseHeight: number;
  /** Appelé après chaque ajout (pour sélectionner l'élément créé). */
  onElementAdded?: (id: string) => void;
}) {
  const [elements, dispatch] = useReducer(documentReducer, []);
  /** objectURLs vivants, révoqués à la suppression de l'élément. */
  const objectUrlsRef = useRef(new Map<string, string>());
  const onElementAddedRef = useRef(onElementAdded);
  onElementAddedRef.current = onElementAdded;

  const addText = useCallback(() => {
    const el: TextElement = {
      id: crypto.randomUUID(),
      type: "text",
      text: "Votre texte",
      fontSize: 32,
      fill: "#1a1a1a",
      x: baseWidth / 2 - 90,
      y: baseHeight / 2 - 16,
      rotation: 0,
    };
    dispatch({ type: "add", element: el });
    onElementAddedRef.current?.(el.id);
  }, [baseWidth, baseHeight]);

  const addImageFromFile = useCallback(
    (file: File) => {
      const src = URL.createObjectURL(file);
      // Préchargement pour connaître les dimensions naturelles.
      const probe = new window.Image();
      probe.onload = () => {
        const k = Math.min(
          1,
          (baseWidth * 0.6) / probe.width,
          (baseHeight * 0.6) / probe.height,
        );
        const width = probe.width * k;
        const height = probe.height * k;
        const el: ImageElement = {
          id: crypto.randomUUID(),
          type: "image",
          src,
          x: (baseWidth - width) / 2,
          y: (baseHeight - height) / 2,
          rotation: 0,
          width,
          height,
        };
        objectUrlsRef.current.set(el.id, src);
        dispatch({ type: "add", element: el });
        onElementAddedRef.current?.(el.id);
      };
      probe.src = src;
    },
    [baseWidth, baseHeight],
  );

  const updateElement = useCallback((element: LabelElement) => {
    dispatch({ type: "update", element });
  }, []);

  const removeElement = useCallback((id: string) => {
    const url = objectUrlsRef.current.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      objectUrlsRef.current.delete(id);
    }
    dispatch({ type: "remove", id });
  }, []);

  // --- Libère les objectURLs restants au démontage ---
  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => {
      for (const url of urls.values()) URL.revokeObjectURL(url);
    };
  }, []);

  return { elements, addText, addImageFromFile, updateElement, removeElement };
}
