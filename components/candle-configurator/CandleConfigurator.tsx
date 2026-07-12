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
 * Configurateur : l'éditeur d'étiquette à gauche, la bougie 3D à droite.
 * La texture exportée par l'éditeur (débouncée à 500 ms) est projetée
 * telle quelle sur le godet.
 */
export default function CandleConfigurator() {
  const [labelDataUrl, setLabelDataUrl] = useState<string | null>(null);

  return (
    <div className="grid w-full items-center gap-8 lg:grid-cols-2">
      <LabelEditor
        widthCm={LABEL_WIDTH_CM}
        heightCm={LABEL_HEIGHT_CM}
        onExport={setLabelDataUrl}
      />
      <CandleViewer
        label={
          labelDataUrl
            ? { imageUrl: labelDataUrl, heightCm: LABEL_HEIGHT_CM }
            : undefined
        }
        className="h-[32rem] w-full"
      />
    </div>
  );
}
