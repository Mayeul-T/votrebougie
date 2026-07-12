"use client";

import { FONT_FAMILIES, type TextAlign, type TextElement } from "./types";

const groupClass =
  "flex items-center overflow-hidden rounded-lg border border-zinc-300 dark:border-zinc-700";
const buttonClass =
  "px-2.5 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-100 aria-pressed:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:aria-pressed:bg-zinc-700";

/** Icône d'alignement : 4 lignes horizontales dont la largeur suit le mode. */
function AlignIcon({ align }: { align: TextAlign }) {
  const widths = {
    left: [10, 6],
    center: [10, 6],
    right: [10, 6],
    justify: [10, 10],
  }[align];
  const x = (w: number) =>
    align === "right" ? 12 - w : align === "center" ? (12 - w) / 2 : 0;
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {[1.5, 4.5, 7.5, 10.5].map((y, i) => {
        const w = widths[i % 2];
        return <line key={y} x1={x(w)} y1={y} x2={x(w) + w} y2={y} />;
      })}
    </svg>
  );
}

const ALIGNMENTS: { value: TextAlign; title: string }[] = [
  { value: "left", title: "Aligner à gauche" },
  { value: "center", title: "Centrer" },
  { value: "right", title: "Aligner à droite" },
  { value: "justify", title: "Justifier" },
];

/**
 * Barre d'outils contextuelle du texte sélectionné. Les boutons annulent
 * le mousedown pour ne pas voler le focus du textarea d'édition : les
 * styles s'appliquent en direct pendant la frappe.
 */
export default function TextToolbox({
  element,
  onChange,
}: {
  element: TextElement;
  onChange: (element: TextElement) => void;
}) {
  const keepFocus = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className="flex flex-wrap items-center gap-2 pb-3">
      <select
        value={element.fontFamily}
        onChange={(e) => onChange({ ...element, fontFamily: e.target.value })}
        className="rounded-lg border border-zinc-300 bg-transparent px-2 py-1.5 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300 dark:[&>option]:bg-zinc-900"
        title="Police"
      >
        {FONT_FAMILIES.map((font) => (
          <option key={font} value={font} style={{ fontFamily: font }}>
            {font}
          </option>
        ))}
      </select>

      <input
        type="number"
        min={6}
        max={200}
        value={element.fontSize}
        onChange={(e) => {
          const fontSize = Number(e.target.value);
          if (Number.isFinite(fontSize)) {
            onChange({
              ...element,
              fontSize: Math.min(200, Math.max(6, fontSize)),
            });
          }
        }}
        className="w-16 rounded-lg border border-zinc-300 bg-transparent px-2 py-1.5 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
        title="Taille de police"
      />

      <div className={groupClass}>
        <button
          type="button"
          className={`${buttonClass} font-bold`}
          aria-pressed={element.bold}
          title="Gras"
          onMouseDown={keepFocus}
          onClick={() => onChange({ ...element, bold: !element.bold })}
        >
          B
        </button>
        <button
          type="button"
          className={`${buttonClass} italic`}
          aria-pressed={element.italic}
          title="Italique"
          onMouseDown={keepFocus}
          onClick={() => onChange({ ...element, italic: !element.italic })}
        >
          I
        </button>
        <button
          type="button"
          className={`${buttonClass} underline`}
          aria-pressed={element.underline}
          title="Souligné"
          onMouseDown={keepFocus}
          onClick={() =>
            onChange({ ...element, underline: !element.underline })
          }
        >
          S
        </button>
      </div>

      <div className={groupClass}>
        {ALIGNMENTS.map(({ value, title }) => (
          <button
            key={value}
            type="button"
            className={buttonClass}
            aria-pressed={element.align === value}
            title={title}
            onMouseDown={keepFocus}
            onClick={() => onChange({ ...element, align: value })}
          >
            <AlignIcon align={value} />
          </button>
        ))}
      </div>
    </div>
  );
}
