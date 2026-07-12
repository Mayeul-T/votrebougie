import { describe, expect, test } from "bun:test";
import { computeSnap, getGuideStops, type Rect } from "./snapping";

const LABEL = { width: 600, height: 210 };

const stops = (others: Rect[] = []) =>
  getGuideStops(LABEL.width, LABEL.height, others);

describe("getGuideStops", () => {
  test("contient les bords, le centre et les quarts horizontaux de l'étiquette", () => {
    expect(stops()).toEqual({
      vertical: [0, 150, 300, 450, 600],
      horizontal: [0, 105, 210],
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
    // Bord gauche à 1 px de 0, bord haut à 2 px de 0 : double accrochage.
    const drag: Rect = { x: 1, y: -2, width: 100, height: 30 };
    const { dx, dy, guides } = computeSnap(stops(), drag, 5);
    expect(dx).toBe(-1);
    expect(dy).toBe(2);
    expect(guides).toHaveLength(2);
  });
});
