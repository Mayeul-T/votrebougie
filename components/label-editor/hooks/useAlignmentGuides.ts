"use client";

import Konva from "konva";
import { type RefObject, useCallback } from "react";
import {
  computeSnap,
  getGuideStops,
  type Rect,
  SNAP_THRESHOLD_PX,
  snapValue,
} from "../snapping";

/** Style Canva : lignes fuchsia, distinctes du bleu de sélection. */
const GUIDE_COLOR = "#d946ef";

/**
 * Guides d'alignement magnétiques pendant le drag (position du nœud) et
 * le resize (position de la poignée, via anchorDragBoundFunc). Le dessin
 * est impératif — drag et transform tirent à ~60 Hz, on ne re-rend pas
 * l'arbre React pour des lignes éphémères.
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
  const clearGuides = useCallback(() => {
    guidesLayerRef.current?.destroyChildren();
  }, [guidesLayerRef]);

  /** Bords et centres des autres éléments, en pixels de base. */
  const getOtherRects = useCallback(
    (layer: Konva.Layer, node: Konva.Node): Rect[] =>
      layer
        .getChildren((child) => child !== node)
        .map((child) => child.getClientRect({ relativeTo: layer })),
    [],
  );

  /**
   * Accroche la poignée de resize du Transformer aux stops d'alignement.
   * Konva fournit et attend des coordonnées absolues (Stage scalé compris).
   * Avec keepRatio, une position hors diagonale serait re-projetée par le
   * Transformer (et l'accrochage perdu) : on fixe donc l'axe accroché sur
   * le stop et on recalcule l'autre axe depuis le coin fixe du ratio.
   */
  const boundAnchor = useCallback(
    (
      newPos: Konva.Vector2d,
      node: Konva.Node | undefined,
      anchorName: string,
    ): Konva.Vector2d => {
      const layer = contentLayerRef.current;
      if (!layer || !node) return newPos;

      const toBase = layer.getAbsoluteTransform().copy().invert();
      const p = toBase.point(newPos);
      const stops = getGuideStops(
        baseWidth,
        baseHeight,
        getOtherRects(layer, node),
      );
      const threshold = SNAP_THRESHOLD_PX / displayScale;
      const sx = snapValue(stops.vertical, p.x, threshold);
      const sy = snapValue(stops.horizontal, p.y, threshold);
      if (sx === null && sy === null) return newPos;

      const rect = node.getClientRect({ relativeTo: layer });
      let snapped: Konva.Vector2d;
      if (node.rotation() !== 0 || rect.height === 0) {
        // Nœud tourné : l'AABB ne suit plus la diagonale du Transformer,
        // on se contente d'un accrochage par axe (meilleur effort).
        snapped = { x: sx ?? p.x, y: sy ?? p.y };
      } else {
        // Coin fixe = l'opposé de la poignée tirée ; il ne bouge pas.
        const fixed = {
          x: anchorName.includes("left") ? rect.x + rect.width : rect.x,
          y: anchorName.includes("top") ? rect.y + rect.height : rect.y,
        };
        const ratio = rect.width / rect.height;
        // On retient l'axe accroché le plus proche et on projette l'autre
        // sur la diagonale du ratio.
        const xCloser =
          sx !== null &&
          (sy === null || Math.abs(sx - p.x) <= Math.abs(sy - p.y));
        if (xCloser && sx !== null) {
          const dy = Math.abs(sx - fixed.x) / ratio;
          snapped = { x: sx, y: fixed.y + Math.sign(p.y - fixed.y) * dy };
        } else if (sy !== null) {
          const dx = Math.abs(sy - fixed.y) * ratio;
          snapped = { x: fixed.x + Math.sign(p.x - fixed.x) * dx, y: sy };
        } else {
          snapped = p;
        }
      }
      return layer.getAbsoluteTransform().point(snapped);
    },
    [contentLayerRef, baseWidth, baseHeight, displayScale, getOtherRects],
  );

  /** Calcule l'alignement du nœud, redessine les guides, accroche si demandé. */
  const updateGuides = useCallback(
    (node: Konva.Node, options: { snap: boolean }) => {
      const layer = contentLayerRef.current;
      const guidesLayer = guidesLayerRef.current;
      if (!layer || !guidesLayer) return;

      const { dx, dy, guides } = computeSnap(
        getGuideStops(baseWidth, baseHeight, getOtherRects(layer, node)),
        node.getClientRect({ relativeTo: layer }),
        // Seuil constant à l'écran, quelle que soit l'échelle d'affichage.
        SNAP_THRESHOLD_PX / displayScale,
      );

      if (options.snap) {
        // Recalculé à chaque move depuis la position du pointeur :
        // l'accrochage se relâche naturellement au-delà du seuil.
        node.x(node.x() + dx);
        node.y(node.y() + dy);
      }

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
    [
      contentLayerRef,
      guidesLayerRef,
      baseWidth,
      baseHeight,
      displayScale,
      getOtherRects,
    ],
  );

  const onDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) =>
      updateGuides(e.target, { snap: true }),
    [updateGuides],
  );

  /** À appeler pendant le resize avec le nœud en cours de transformation. */
  const onTransformMove = useCallback(
    (node: Konva.Node) => updateGuides(node, { snap: false }),
    [updateGuides],
  );

  return { onDragMove, onTransformMove, boundAnchor, clearGuides };
}
