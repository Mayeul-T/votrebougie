import type { ImageElement } from "./types";

export type EraserStatus = "processing" | "ready" | "error" | "unavailable";

export type MagicEraserPanelProps = {
  element: ImageElement;
  status: EraserStatus;
  /** Un clic est en cours de traitement côté serveur. */
  busy: boolean;
  /** Clic sur l'image, coordonnées normalisées [0,1]. */
  onClickPoint: (x: number, y: number) => void;
};

/**
 * Éditeur « en grand » de l'image sélectionnée : la gomme magique.
 * Un clic sur un morceau visible le retire du détourage, un clic sur un
 * morceau retiré le réintègre ; le damier rend la transparence lisible.
 */
export default function MagicEraserPanel({
  element,
  status,
  busy,
  onClickPoint,
}: MagicEraserPanelProps) {
  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    if (status !== "ready" || busy) return;
    const rect = e.currentTarget.getBoundingClientRect();
    onClickPoint(
      (e.clientX - rect.left) / rect.width,
      (e.clientY - rect.top) / rect.height,
    );
  };

  return (
    <div className="mt-4 min-w-0">
      <div className="flex items-baseline justify-between pb-2">
        <h3 className="text-sm font-semibold">Gomme magique</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {status === "processing" && "Détourage en cours…"}
          {status === "ready" &&
            (busy
              ? "Découpe du morceau…"
              : "Cliquez sur un morceau pour le retirer, re-cliquez pour le remettre.")}
          {status === "error" && "Serveur de détourage injoignable."}
        </p>
      </div>
      <div className="w-full bg-zinc-100 p-4 lg:p-8">
        {/* Damier : les zones transparentes du PNG restent lisibles. */}
        <button
          type="button"
          onClick={handleClick}
          disabled={status !== "ready" || busy}
          aria-label="Gomme magique : cliquer un morceau de l'image"
          className={`block w-full cursor-crosshair border-0 p-0 shadow-[0_6px_18px_rgba(0,0,0,0.28)] [background:repeating-conic-gradient(#e4e4e7_0%_25%,#fafafa_0%_50%)_0_0/24px_24px] disabled:cursor-wait ${
            busy || status === "processing" ? "opacity-60" : ""
          }`}
        >
          {/* biome-ignore lint/performance/noImgElement: objectURL local, next/image inutile */}
          <img
            src={element.src}
            alt="Visuel en cours de détourage"
            className="block h-auto w-full select-none"
            draggable={false}
          />
        </button>
      </div>
    </div>
  );
}
