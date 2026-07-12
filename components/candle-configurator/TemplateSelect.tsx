"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useState } from "react";
import { useCandleTemplate } from "./CandleTemplateContext";
import { CANDLE_TEMPLATES } from "./templates";

const dialogButtonClass =
  "rounded-full border border-zinc-300 px-4 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

/**
 * Sélecteur du template actif. Changer de template réinitialise le
 * document de l'étiquette : quand `confirmBeforeChange` est vrai (des
 * éléments seraient perdus), une modale demande confirmation avant
 * d'appliquer le changement.
 */
export default function TemplateSelect({
  confirmBeforeChange,
}: {
  confirmBeforeChange: boolean;
}) {
  const { template, setTemplateId } = useCandleTemplate();
  /** Template demandé, en attente de confirmation (modale ouverte). */
  const [pendingId, setPendingId] = useState<string | null>(null);

  const requestChange = (id: string) => {
    if (id === template.id) return;
    if (confirmBeforeChange) setPendingId(id);
    else setTemplateId(id);
  };

  return (
    <>
      <label className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
        Modèle de bougie
        {/* Le select est contrôlé par le template actif : annuler la
            modale le fait revenir tout seul à la valeur courante. */}
        <select
          value={template.id}
          onChange={(e) => requestChange(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-transparent px-3 py-1.5 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300 dark:[&>option]:bg-zinc-900"
        >
          {CANDLE_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <AlertDialog.Root
        open={pendingId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingId(null);
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/40" />
          <AlertDialog.Content className="fixed top-1/2 left-1/2 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <AlertDialog.Title className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              Changer de modèle ?
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              L'étiquette n'a pas les mêmes dimensions sur ce modèle : les
              textes et images que vous avez ajoutés seront supprimés.
            </AlertDialog.Description>
            <div className="mt-6 flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <button type="button" className={dialogButtonClass}>
                  Annuler
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  type="button"
                  className="rounded-full bg-zinc-900 px-4 py-1.5 text-sm text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                  onClick={() => {
                    if (pendingId) setTemplateId(pendingId);
                    setPendingId(null);
                  }}
                >
                  Changer de modèle
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}
