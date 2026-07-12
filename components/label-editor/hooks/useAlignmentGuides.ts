"use client";

import Konva from "konva";
import { type RefObject, useCallback } from "react";
import {
  computeSnap,
  getGuideStops,
  type Rect,
  SNAP_THRESHOLD_PX,
} from "../snapping";

/** Style Canva : lignes fuchsia, distinctes du bleu de sélection. */
const GUIDE_COLOR = "#d946ef";

/**
 * Guides d'alignement magnétiques pendant le drag. Les handlers sont à
 * attacher à la couche de contenu (les événements Konva bubblent depuis
 * les éléments). Le dessin est impératif — le dragmove tire à ~60 Hz,
 * on ne re-rend pas l'arbre React pour des lignes éphémères.
 */
export default function useAlignmentGuides({
  contentLayerRef,
  guidesLayerRef,
  baseWidth,
  baseHeight,
  displayScale,
}: {
  contentLayerRef: RefObject<Konva.Layer | null>;
  guidesLayerRef: RefObject<Konva.Layer | null>;
  baseWidth: number;
  baseHeight: number;
  displayScale: number;
}) {
  const onDragEnd = useCallback(() => {
    guidesLayerRef.current?.destroyChildren();
  }, [guidesLayerRef]);

  const onDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const layer = contentLayerRef.current;
      const guidesLayer = guidesLayerRef.current;
      const node = e.target;
      if (!layer || !guidesLayer) return;

      // Bords et centres des autres éléments (AABB, rotation comprise),
      // en pixels de base : tout est relatif à la couche, pas au Stage scalé.
      const otherRects: Rect[] = layer
        .getChildren(
          (child) => child !== node && child.name() !== "label-background",
        )
        .map((child) => child.getClientRect({ relativeTo: layer }));

      const { dx, dy, guides } = computeSnap(
        getGuideStops(baseWidth, baseHeight, otherRects),
        node.getClientRect({ relativeTo: layer }),
        // Seuil constant à l'écran, quelle que soit l'échelle d'affichage.
        SNAP_THRESHOLD_PX / displayScale,
      );

      // Recalculé à chaque move depuis la position du pointeur :
      // l'accrochage se relâche naturellement au-delà du seuil.
      node.x(node.x() + dx);
      node.y(node.y() + dy);

      guidesLayer.destroyChildren();
      for (const g of guides) {
        guidesLayer.add(
          new Konva.Line({
            points:
              g.orientation === "vertical"
                ? [g.position, 0, g.position, baseHeight]
                : [0, g.position, baseWidth, g.position],
            stroke: GUIDE_COLOR,
            strokeWidth: 1,
            strokeScaleEnabled: false,
            dash: [4, 6],
            listening: false,
          }),
        );
      }
    },
    [contentLayerRef, guidesLayerRef, baseWidth, baseHeight, displayScale],
  );

  return { onDragMove, onDragEnd };
}
