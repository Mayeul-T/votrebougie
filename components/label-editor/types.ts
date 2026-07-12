/**
 * Police unique de l'éditeur : une fonte système évite toute course de
 * chargement de webfont entre le canvas Konva et le textarea d'édition.
 */
export const LABEL_FONT_FAMILY = "sans-serif";

/** Élément de base positionnable sur l'étiquette (coordonnées en pixels de base). */
type BaseElement = {
  id: string;
  x: number;
  y: number;
  /** Rotation en degrés. */
  rotation: number;
};

/** Image importée par l'utilisateur (objectURL local). */
export type ImageElement = BaseElement & {
  type: "image";
  src: string;
  width: number;
  height: number;
};

/** Texte libre, éditable au double-clic. */
export type TextElement = BaseElement & {
  type: "text";
  text: string;
  fontSize: number;
  fill: string;
};

export type LabelElement = ImageElement | TextElement;
