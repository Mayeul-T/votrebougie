import { describe, expect, test } from "bun:test";
import {
  clampRectToBounds,
  computeSnap,
  getGuideStops,
  type Rect,
  rotatedBoxAABB,
  snapValue,
} from "./snapping";

const LABEL = { width: 600, height: 210 };

const stops = (others: Rect[] = []) =>
  getGuideStops(LABEL.width, LABEL.height, others);

describe("getGuideStops", () => {
  test("contient le centre et les quarts de l'étiquette, sans les bords", () => {
    expect(stops()).toEqual({
      vertical: [150, 300, 450],
      horizontal: [105],
    });
  });

  test("ajoute bords et centres des autres éléments", () => {
    const other: Rect = { x: 100, y: 50, width: 40, height: 20 };
    const { vertical, horizontal } = stops([other]);
    expect(vertical).toContain(100); // bord gauche
    expect(vertical).toContain(120); // centre
    expect(vertical).toContain(140); // bord droit
    expect(horizontal).toContain(50);
    expect(horizontal).toContain(60);
    expect(horizontal).toContain(70);
  });
});

describe("snapValue", () => {
  test("accroche au stop le plus proche sous le seuil", () => {
    expect(snapValue([0, 150, 300], 148, 5)).toBe(150);
    expect(snapValue([0, 150, 300], 152, 5)).toBe(150);
  });

  test("null hors seuil", () => {
    expect(snapValue([0, 150, 300], 100, 5)).toBeNull();
  });
});

describe("clampRectToBounds", () => {
  test("aucun décalage quand le rectangle est dans la zone", () => {
    expect(
      clampRectToBounds({ x: 10, y: 10, width: 50, height: 20 }, 600, 210),
    ).toEqual({ dx: 0, dy: 0 });
  });

  test("ramène un débordement à droite et en bas", () => {
    expect(
      clampRectToBounds({ x: 580, y: 200, width: 50, height: 20 }, 600, 210),
    ).toEqual({ dx: -30, dy: -10 });
  });

  test("ramène un débordement à gauche et en haut", () => {
    expect(
      clampRectToBounds({ x: -5, y: -8, width: 50, height: 20 }, 600, 210),
    ).toEqual({ dx: 5, dy: 8 });
  });

  test("rectangle plus large que la zone : bord gauche prioritaire", () => {
    const { dx } = clampRectToBounds(
      { x: 10, y: 0, width: 700, height: 20 },
      600,
      210,
    );
    expect(dx).toBe(-10);
  });
});

describe("rotatedBoxAABB", () => {
  test("sans rotation, la boîte est inchangée", () => {
    expect(
      rotatedBoxAABB({ x: 10, y: 20, width: 100, height: 40, rotation: 0 }),
    ).toEqual({ x: 10, y: 20, width: 100, height: 40 });
  });

  test("à 90°, largeur et hauteur s'échangent", () => {
    const aabb = rotatedBoxAABB({
      x: 0,
      y: 0,
      width: 100,
      height: 40,
      rotation: Math.PI / 2,
    });
    expect(aabb.width).toBeCloseTo(40);
    expect(aabb.height).toBeCloseTo(100);
    expect(aabb.x).toBeCloseTo(-40);
    expect(aabb.y).toBeCloseTo(0);
  });
});

describe("computeSnap", () => {
  test("accroche le centre de l'élément au centre de l'étiquette", () => {
    // Centre à 297 → à 3 px du centre 300 : accroché.
    const drag: Rect = { x: 247, y: 20, width: 100, height: 30 };
    const { dx, dy, guides } = computeSnap(stops(), drag, 5);
    expect(dx).toBe(3);
    expect(dy).toBe(0);
    expect(guides).toEqual([{ orientation: "vertical", position: 300 }]);
  });

  test("accroche au bord d'un autre élément", () => {
    const other: Rect = { x: 200, y: 100, width: 80, height: 40 };
    // Bord gauche à 202 → à 2 px du bord gauche de l'autre (200).
    const drag: Rect = { x: 202, y: 20, width: 50, height: 30 };
    const { dx, guides } = computeSnap(stops([other]), drag, 5);
    expect(dx).toBe(-2);
    expect(guides).toContainEqual({ orientation: "vertical", position: 200 });
  });

  test("aucun accrochage hors seuil", () => {
    const drag: Rect = { x: 50, y: 50, width: 20, height: 20 };
    const { dx, dy, guides } = computeSnap(stops(), drag, 5);
    expect(dx).toBe(0);
    expect(dy).toBe(0);
    expect(guides).toEqual([]);
  });

  test("choisit le stop le plus proche et peut accrocher les deux axes", () => {
    // Bord gauche à 1 px du quart (150), centre vertical à 2 px du
    // centre de l'étiquette (105) : double accrochage.
    const drag: Rect = { x: 151, y: 88, width: 100, height: 30 };
    const { dx, dy, guides } = computeSnap(stops(), drag, 5);
    expect(dx).toBe(-1);
    expect(dy).toBe(2);
    expect(guides).toHaveLength(2);
  });
});
