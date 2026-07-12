"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import CandleViewer from "@/components/CandleViewer";
import {
  CandleTemplateProvider,
  useCandleTemplate,
} from "./CandleTemplateContext";
import TemplateSelect from "./TemplateSelect";

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

export default function CandleConfigurator() {
  return (
    <CandleTemplateProvider>
      <ConfiguratorContent />
    </CandleTemplateProvider>
  );
}

/**
 * Configurateur : le sélecteur de modèle en tête, l'aperçu 3D à gauche
 * (~30 % de la largeur), l'éditeur d'étiquette à droite. La texture
 * exportée par l'éditeur (débouncée à 500 ms) est projetée telle quelle
 * sur le godet. Changer de modèle réinitialise le document de l'étiquette
 * (dimensions différentes) — TemplateSelect demande confirmation s'il y a
 * des éléments à perdre.
 */
function ConfiguratorContent() {
  const { template } = useCandleTemplate();
  const [labelDataUrl, setLabelDataUrl] = useState<string | null>(null);
  const [labelHasContent, setLabelHasContent] = useState(false);

  // Reset synchrone au changement de modèle : l'ancienne texture ne doit
  // pas s'afficher une frame sur le nouveau godet (l'éditeur, remonté via
  // key, ré-exportera la sienne).
  const [prevTemplateId, setPrevTemplateId] = useState(template.id);
  if (prevTemplateId !== template.id) {
    setPrevTemplateId(template.id);
    setLabelDataUrl(null);
    setLabelHasContent(false);
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <TemplateSelect confirmBeforeChange={labelHasContent} />

      <div className="grid w-full items-center gap-8 lg:grid-cols-[3fr_7fr]">
        <CandleViewer
          radiusMm={template.candle.radiusMm}
          heightMm={template.candle.heightMm}
          waxColor={template.candle.color}
          waxEdgeRadiusMm={template.candle.edgeRadiusMm}
          cup={template.cup ?? undefined}
          label={
            labelDataUrl
              ? { imageUrl: labelDataUrl, heightMm: template.label.heightMm }
              : undefined
          }
          className="h-72 w-full min-w-0 overflow-hidden lg:h-[28rem]"
        />
        <LabelEditor
          key={template.id}
          widthMm={template.label.widthMm}
          heightMm={template.label.heightMm}
          onExport={setLabelDataUrl}
          onContentChange={setLabelHasContent}
          className="w-full min-w-0"
        />
      </div>
    </div>
  );
}
