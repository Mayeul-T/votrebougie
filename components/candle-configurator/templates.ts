/**
 * Formes de bougie disponibles dans le configurateur. Presets en dur pour
 * l'instant ; le type est volontairement du JSON pur (pas d'instance, pas
 * de fonction, couleurs en hex CSS) pour partir tel quel en base de
 * données plus tard. Toutes les dimensions sont en millimètres.
 */
export type CandleTemplate = {
  /** Slug stable (future clé primaire) ; `name` reste libre de changer. */
  id: string;
  /** Nom affiché à l'utilisateur. */
  name: string;
  candle: {
    radiusMm: number;
    heightMm: number;
  };
  cup: {
    /** Hauteur totale du godet depuis le sol, pied compris. */
    heightMm: number;
    /** Hauteur du pied : le fond du godet est surélevé d'autant. 0 = posé au sol. */
    footMm: number;
    /** Épaisseur du plastique. */
    thicknessMm: number;
    /** Couleur du plastique, hex CSS. */
    color: string;
    /** Opacité du plastique : 0 invisible → 1 opaque. */
    opacity: number;
  };
  label: {
    widthMm: number;
    /** L'étiquette est toujours centrée en hauteur sur le godet. */
    heightMm: number;
  };
};

export const CANDLE_TEMPLATES: CandleTemplate[] = [
  {
    id: "veilleuse-classique",
    name: "Veilleuse classique",
    candle: { radiusMm: 50, heightMm: 125 },
    cup: {
      heightMm: 140,
      footMm: 5,
      thicknessMm: 1,
      color: "#ffffff",
      opacity: 0.35,
    },
    label: { widthMm: 200, heightMm: 70 },
  },
  {
    id: "veilleuse-petite",
    name: "Petite veilleuse",
    candle: { radiusMm: 40, heightMm: 90 },
    cup: {
      heightMm: 102,
      footMm: 4,
      thicknessMm: 1,
      color: "#ffffff",
      opacity: 0.35,
    },
    label: { widthMm: 160, heightMm: 50 },
  },
  {
    id: "veilleuse-grande-ambree",
    name: "Grande veilleuse ambrée",
    candle: { radiusMm: 60, heightMm: 150 },
    cup: {
      heightMm: 168,
      footMm: 6,
      thicknessMm: 1.2,
      color: "#e8b06a",
      opacity: 0.45,
    },
    label: { widthMm: 240, heightMm: 80 },
  },
];

export const DEFAULT_TEMPLATE_ID = CANDLE_TEMPLATES[0].id;
