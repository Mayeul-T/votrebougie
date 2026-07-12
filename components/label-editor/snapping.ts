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
 * Positions d'accrochage candidates : centre et quarts horizontaux de
 * l'étiquette (elle enveloppe la bougie : on peut ainsi centrer sur une
 * moitié visible), puis bords et centres de chacun des autres éléments.
 * Pas de stops sur les bords de l'étiquette : le déplacement y est déjà
 * borné, la butée fait office d'accrochage.
 */
export function getGuideStops(
  baseWidth: number,
  baseHeight: number,
  otherRects: Rect[],
): GuideStops {
  const vertical = [baseWidth / 4, baseWidth / 2, (3 * baseWidth) / 4];
  const horizontal = [baseHeight / 2];
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

/**
 * Décalage (dx, dy) à appliquer pour ramener un rectangle dans les bornes
 * [0, width] × [0, height]. Si le rectangle est plus grand que la zone,
 * son bord gauche/haut fait foi.
 */
export function clampRectToBounds(
  rect: Rect,
  width: number,
  height: number,
): { dx: number; dy: number } {
  let dx = 0;
  let dy = 0;
  if (rect.x + rect.width > width) dx = width - (rect.x + rect.width);
  if (rect.y + rect.height > height) dy = height - (rect.y + rect.height);
  if (rect.x + dx < 0) dx = -rect.x;
  if (rect.y + dy < 0) dy = -rect.y;
  return { dx, dy };
}

/** Boîte du Transformer Konva : position, taille et rotation en radians. */
export type RotatedBox = Rect & { rotation: number };

/** AABB d'une boîte pivotée autour de son coin haut-gauche. */
export function rotatedBoxAABB(box: RotatedBox): Rect {
  const cos = Math.cos(box.rotation);
  const sin = Math.sin(box.rotation);
  const corners = [
    { x: 0, y: 0 },
    { x: box.width, y: 0 },
    { x: box.width, y: box.height },
    { x: 0, y: box.height },
  ].map((p) => ({
    x: box.x + p.x * cos - p.y * sin,
    y: box.y + p.x * sin + p.y * cos,
  }));
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
  };
}

/** Stop le plus proche d'une valeur isolée sous le seuil, sinon null. */
export function snapValue(
  stops: number[],
  value: number,
  threshold: number,
): number | null {
  let best: number | null = null;
  let bestDiff = threshold;
  for (const stop of stops) {
    const diff = Math.abs(stop - value);
    if (diff < bestDiff) {
      best = stop;
      bestDiff = diff;
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
