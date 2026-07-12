"use client";

import { useRef } from "react";

const buttonClass =
  "rounded-full border border-zinc-300 px-4 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-40 disabled:hover:bg-transparent dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

/** Barre d'outils verticale de l'éditeur : présentation pure, aucun état métier. */
export default function EditorToolbox({
  onAddImage,
  onAddText,
  onRemoveSelected,
  canRemove,
}: {
  onAddImage: (file: File) => void;
  onAddText: () => void;
  onRemoveSelected: () => void;
  canRemove: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-row flex-wrap gap-2 lg:flex-col lg:items-stretch">
      <button
        type="button"
        className={buttonClass}
        onClick={() => fileInputRef.current?.click()}
      >
        + Image
      </button>
      <button type="button" className={buttonClass} onClick={onAddText}>
        + Texte
      </button>
      <button
        type="button"
        className={buttonClass}
        disabled={!canRemove}
        onClick={onRemoveSelected}
      >
        Supprimer
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onAddImage(file);
        }}
      />
    </div>
  );
}
