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
    /** Couleur de la cire, hex CSS. */
    color: string;
    /** Rayon d'arrondi des arêtes de la cire, en mm (surtout utile sans godet). */
    edgeRadiusMm?: number;
  };
  /** null : pas de godet, l'étiquette est imprimée directement sur la cire. */
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
  } | null;
  label: {
    widthMm: number;
    /** L'étiquette est toujours centrée en hauteur sur le godet (ou la cire). */
    heightMm: number;
  };
};

export const CANDLE_TEMPLATES: CandleTemplate[] = [
  {
    id: "veilleuse-classique",
    name: "Veilleuse classique",
    candle: { radiusMm: 50, heightMm: 125, color: "#ffffff" },
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
    id: "veilleuse-godet-rouge",
    name: "Veilleuse godet rouge",
    candle: { radiusMm: 50, heightMm: 125, color: "#ffffff" },
    cup: {
      heightMm: 140,
      footMm: 5,
      thicknessMm: 1,
      color: "#9e1712",
      opacity: 0.9,
    },
    label: { widthMm: 200, heightMm: 70 },
  },
  {
    id: "veilleuse-godet-vert-pied",
    name: "Veilleuse godet vert à pied",
    candle: { radiusMm: 50, heightMm: 125, color: "#ffffff" },
    cup: {
      // Pied = 1/4 de la hauteur de la bougie (125 mm).
      heightMm: 166,
      footMm: 31,
      thicknessMm: 1,
      color: "#2e7d4f",
      opacity: 0.45,
    },
    label: { widthMm: 200, heightMm: 70 },
  },
  {
    id: "pilier-ambre",
    name: "Pilier ambré sans godet",
    candle: { radiusMm: 40, heightMm: 140, color: "#f4d8b5", edgeRadiusMm: 8 },
    cup: null,
    label: { widthMm: 200, heightMm: 60 },
  },
];

export const DEFAULT_TEMPLATE_ID = CANDLE_TEMPLATES[0].id;
