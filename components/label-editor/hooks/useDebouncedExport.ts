"use client";

import type Konva from "konva";
import { type RefObject, useEffect } from "react";

/** Largeur cible de la texture exportée, quel que soit l'affichage. */
const EXPORT_WIDTH = 1200;
/** Délai de debounce entre la dernière interaction et l'export. */
const EXPORT_DELAY_MS = 500;

/**
 * Exporte la couche de contenu en dataURL PNG, débouncé : tout changement
 * d'un déclencheur relance le compte à rebours.
 */
export default function useDebouncedExport({
  layerRef,
  onExport,
  triggers,
}: {
  layerRef: RefObject<Konva.Layer | null>;
  onExport: (dataUrl: string) => void;
  /** Valeurs dont le changement doit provoquer un (ré)export. */
  triggers: readonly unknown[];
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      const layer = layerRef.current;
      const stage = layer?.getStage();
      if (!layer || !stage) return;
      onExport(
        layer.toDataURL({
          x: 0,
          y: 0,
          width: stage.width(),
          height: stage.height(),
          // Compense l'échelle d'affichage : la texture fait toujours
          // EXPORT_WIDTH px de large, même après un resize de fenêtre.
          pixelRatio: EXPORT_WIDTH / stage.width(),
        }),
      );
    }, EXPORT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [layerRef, onExport, ...triggers]);
}
