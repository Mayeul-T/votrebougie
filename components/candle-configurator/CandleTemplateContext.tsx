"use client";

import { createContext, useContext, useMemo, useState } from "react";
import {
  CANDLE_TEMPLATES,
  type CandleTemplate,
  DEFAULT_TEMPLATE_ID,
} from "./templates";

type CandleTemplateContextValue = {
  /** Le template actif, toujours résolu (jamais null). */
  template: CandleTemplate;
  setTemplateId: (id: string) => void;
};

const CandleTemplateContext = createContext<CandleTemplateContextValue | null>(
  null,
);

/**
 * Détient le template actif. Seul endroit à modifier quand les presets
 * viendront de la base de données (fetch ici, consommateurs inchangés).
 */
export function CandleTemplateProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE_ID);

  const value = useMemo<CandleTemplateContextValue>(
    () => ({
      // Repli sur le premier preset si l'id ne résout plus (preset retiré).
      template:
        CANDLE_TEMPLATES.find((t) => t.id === templateId) ??
        CANDLE_TEMPLATES[0],
      setTemplateId,
    }),
    [templateId],
  );

  return (
    <CandleTemplateContext.Provider value={value}>
      {children}
    </CandleTemplateContext.Provider>
  );
}

export function useCandleTemplate() {
  const ctx = useContext(CandleTemplateContext);
  if (!ctx) {
    throw new Error(
      "useCandleTemplate doit être appelé sous <CandleTemplateProvider>",
    );
  }
  return ctx;
}
