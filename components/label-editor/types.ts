/**
 * Set de polices web-safe : disponibles partout sans chargement, donc
 * aucune course de webfont entre le canvas Konva et le textarea d'édition.
 */
export const FONT_FAMILIES = [
  "Arial",
  "Verdana",
  "Trebuchet MS",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Impact",
  "Comic Sans MS",
] as const;

export const DEFAULT_FONT_FAMILY = "Arial";

export type TextAlign = "left" | "center" | "right" | "justify";

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

/** Texte libre (multiligne), éditable au double-clic. */
export type TextElement = BaseElement & {
  type: "text";
  text: string;
  fontSize: number;
  fill: string;
  fontFamily: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: TextAlign;
  /**
   * Largeur fixe du bloc de texte (le texte y revient à la ligne).
   * Konva exige une largeur pour justifier ; undefined = largeur auto.
   */
  width?: number;
};

export type LabelElement = ImageElement | TextElement;
