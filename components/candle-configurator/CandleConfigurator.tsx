"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import CandleViewer from "@/components/CandleViewer";

// Konva résout le paquet natif `canvas` s'il est évalué côté Node :
// chargement client uniquement (ssr:false n'est permis que depuis un
// composant client en Next 16, ce qui est le cas ici).
const LabelEditor = dynamic(
  () => import("@/components/label-editor/LabelEditor"),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 w-full animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
    ),
  },
);

/** Dimensions physiques de l'étiquette imprimée sur le godet, en cm. */
const LABEL_WIDTH_CM = 20;
const LABEL_HEIGHT_CM = 7;

/**
 * Configurateur : l'aperçu 3D à gauche (~30 % de la largeur), l'éditeur
 * d'étiquette à droite, sa barre d'outils au-dessus de l'étiquette. La
 * texture exportée par l'éditeur (débouncée à 500 ms) est projetée telle
 * quelle sur le godet.
 */
export default function CandleConfigurator() {
  const [labelDataUrl, setLabelDataUrl] = useState<string | null>(null);

  return (
    <div className="grid w-full items-center gap-8 lg:grid-cols-[3fr_7fr]">
      <CandleViewer
        label={
          labelDataUrl
            ? { imageUrl: labelDataUrl, heightCm: LABEL_HEIGHT_CM }
            : undefined
        }
        className="h-72 w-full min-w-0 overflow-hidden lg:h-[28rem]"
      />
      <LabelEditor
        widthCm={LABEL_WIDTH_CM}
        heightCm={LABEL_HEIGHT_CM}
        onExport={setLabelDataUrl}
        className="w-full min-w-0"
      />
    </div>
  );
}
