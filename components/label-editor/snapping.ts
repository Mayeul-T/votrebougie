/**
 * Accrochage magnétique des éléments pendant le drag (« smart guides »).
 * Logique pure, sans Konva ni React, adaptée de la démo officielle
 * « Objects Snapping » de Konva. Toutes les valeurs sont en pixels de base.
 */

/** Distance d'accrochage en px écran (à convertir en px de base à l'appel). */
export const SNAP_THRESHOLD_PX = 5;

export type Rect = { x: number; y: number; width: number; height: number };

export type Guide = {
  orientation: "vertical" | "horizontal";
  position: number;
};

export type SnapResult = {
  /** Décalage à appliquer à la position du nœud pour l'accrocher. */
  dx: number;
  dy: number;
  /** Lignes d'aide à dessiner (au plus une par axe). */
  guides: Guide[];
};

export type GuideStops = { vertical: number[]; horizontal: number[] };

/**
 * Positions d'accrochage candidates : bords et centres de l'étiquette,
 * puis bords et centres de chacun des autres éléments.
 * L'axe horizontal de l'étiquette s'accroche aussi aux quarts (l'étiquette
 * enveloppe la bougie : on peut ainsi centrer sur une moitié visible).
 */
export function getGuideStops(
  baseWidth: number,
  baseHeight: number,
  otherRects: Rect[],
): GuideStops {
  const vertical = [
    0,
    baseWidth / 4,
    baseWidth / 2,
    (3 * baseWidth) / 4,
    baseWidth,
  ];
  const horizontal = [0, baseHeight / 2, baseHeight];
  for (const r of otherRects) {
    vertical.push(r.x, r.x + r.width / 2, r.x + r.width);
    horizontal.push(r.y, r.y + r.height / 2, r.y + r.height);
  }
  return { vertical, horizontal };
}

/**
 * Meilleur accrochage d'un axe : le stop le plus proche d'un des points
 * (début / centre / fin du rectangle traîné), s'il est sous le seuil.
 */
function snapAxis(stops: number[], points: number[], threshold: number) {
  let best: { position: number; offset: number; diff: number } | null = null;
  for (const stop of stops) {
    for (const point of points) {
      const diff = Math.abs(stop - point);
      if (diff < threshold && (!best || diff < best.diff)) {
        best = { position: stop, offset: stop - point, diff };
      }
    }
  }
  return best;
}

/** Calcule l'accrochage du rectangle traîné contre les positions candidates. */
export function computeSnap(
  stops: GuideStops,
  dragRect: Rect,
  threshold: number,
): SnapResult {
  const { x, y, width, height } = dragRect;
  const vSnap = snapAxis(
    stops.vertical,
    [x, x + width / 2, x + width],
    threshold,
  );
  const hSnap = snapAxis(
    stops.horizontal,
    [y, y + height / 2, y + height],
    threshold,
  );

  const result: SnapResult = { dx: 0, dy: 0, guides: [] };
  if (vSnap) {
    result.dx = vSnap.offset;
    result.guides.push({ orientation: "vertical", position: vSnap.position });
  }
  if (hSnap) {
    result.dy = hSnap.offset;
    result.guides.push({
      orientation: "horizontal",
      position: hSnap.position,
    });
  }
  return result;
}
