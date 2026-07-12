import type Konva from "konva";
import { useCallback, useRef, useState } from "react";
import EditorStage from "./EditorStage";
import EditorToolbox from "./EditorToolbox";
import useDebouncedExport from "./hooks/useDebouncedExport";
import useDeleteKey from "./hooks/useDeleteKey";
import useDisplayScale from "./hooks/useDisplayScale";
import useLabelDocument from "./hooks/useLabelDocument";
import TextEditOverlay from "./TextEditOverlay";
import TextToolbox from "./TextToolbox";
import type { TextElement } from "./types";

/** Résolution de travail de l'éditeur : 1 cm d'étiquette = 30 px de base. */
const PX_PER_CM = 30;

export type LabelEditorProps = {
  /** Largeur physique de l'étiquette en cm. */
  widthCm: number;
  /** Hauteur physique de l'étiquette en cm. */
  heightCm: number;
  /** Reçoit la texture (dataURL PNG), débouncée à 500 ms. */
  onExport: (dataUrl: string) => void;
  className?: string;
};

/**
 * Assemblage de l'éditeur : le document (useLabelDocument), l'état UI
 * (sélection, édition), et les sous-composants toolbox / stage / overlay.
 */
export default function LabelEditor({
  widthCm,
  heightCm,
  onExport,
  className,
}: LabelEditorProps) {
  const baseWidth = widthCm * PX_PER_CM;
  const baseHeight = heightCm * PX_PER_CM;

  // --- État UI, volontairement hors du document (futur historique undo) ---
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Bump quand une image finit de décoder : un export parti trop tôt
  // aurait figé un emplacement vide sur la bougie.
  const [imageTick, setImageTick] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const contentLayerRef = useRef<Konva.Layer>(null);
  /** Texte au moment du double-clic, restauré si l'édition est annulée. */
  const editOriginalTextRef = useRef<string>("");
  const editingIdRef = useRef<string | null>(null);
  editingIdRef.current = editingId;

  const displayScale = useDisplayScale(containerRef, baseWidth);

  const { elements, addText, addImageFromFile, updateElement, removeElement } =
    useLabelDocument({ baseWidth, baseHeight, onElementAdded: setSelectedId });

  useDebouncedExport({
    layerRef: contentLayerRef,
    onExport,
    triggers: [elements, imageTick],
    // Le texte en cours d'édition est masqué à l'écran (le textarea le
    // recouvre) mais doit apparaître sur la texture de la bougie.
    prepare: () => {
      const id = editingIdRef.current;
      const node = id ? stageRef.current?.findOne(`#${id}`) : null;
      if (!node) return undefined;
      node.visible(true);
      return () => node.visible(false);
    },
  });

  const removeSelected = useCallback(() => {
    if (!selectedId || editingId) return;
    removeElement(selectedId);
    setSelectedId(null);
  }, [selectedId, editingId, removeElement]);

  // Suppression clavier, neutralisée pendant l'édition via removeSelected.
  useDeleteKey(removeSelected);

  const bumpImageTick = useCallback(() => setImageTick((t) => t + 1), []);

  const findTextEl = (id: string | null) =>
    elements.find(
      (el): el is TextElement => el.id === id && el.type === "text",
    );
  const editingEl = findTextEl(editingId);
  const selectedTextEl = findTextEl(selectedId);
  // Nœud Konva du texte en édition, pour caler le textarea sur ses métriques.
  const editingNode = editingEl
    ? (stageRef.current?.findOne(`#${editingEl.id}`) as Konva.Text | undefined)
    : undefined;

  const changeText = (updated: TextElement) => {
    // Konva ne justifie que dans un bloc de largeur fixe : on fige la
    // largeur courante du nœud au moment où l'utilisateur choisit justifier.
    if (updated.align === "justify" && updated.width === undefined) {
      const node = stageRef.current?.findOne(`#${updated.id}`);
      if (node) updated = { ...updated, width: Math.ceil(node.width()) };
    }
    updateElement(updated);
  };

  return (
    <div className={`flex flex-col ${className ?? ""}`}>
      <div className="min-w-0">
        {/* Barre d'outils au-dessus de l'étiquette : actions du document à
            gauche, options contextuelles du texte à droite. Hauteur
            réservée (min-h) : la barre contextuelle apparaît et disparaît
            sans décaler l'étiquette. */}
        <div className="flex min-h-12 flex-wrap items-center gap-x-6 gap-y-2 pb-2">
          <EditorToolbox
            onAddImage={addImageFromFile}
            onAddText={addText}
            onRemoveSelected={removeSelected}
            canRemove={selectedId !== null}
          />
          {selectedTextEl && (
            <TextToolbox element={selectedTextEl} onChange={changeText} />
          )}
        </div>

        {/* Surface de travail à peine teintée ; l'étiquette « posée »
            dessus s'en détache par son blanc pur et son ombre portée. */}
        <div className="w-full bg-zinc-100 p-4 lg:p-8">
          <div
            ref={containerRef}
            className="relative w-full shadow-[0_6px_18px_rgba(0,0,0,0.28)]"
          >
            <EditorStage
              baseWidth={baseWidth}
              baseHeight={baseHeight}
              displayScale={displayScale}
              elements={elements}
              selectedId={selectedId}
              editingId={editingId}
              onSelect={setSelectedId}
              onDeselect={() => setSelectedId(null)}
              onStartEdit={(id) => {
                editOriginalTextRef.current = findTextEl(id)?.text ?? "";
                setSelectedId(id);
                setEditingId(id);
              }}
              onElementChange={updateElement}
              onImageLoaded={bumpImageTick}
              stageRef={stageRef}
              contentLayerRef={contentLayerRef}
            />

            {editingEl && (
              <TextEditOverlay
                element={editingEl}
                node={editingNode}
                displayScale={displayScale}
                onLiveChange={(value) =>
                  updateElement({ ...editingEl, text: value })
                }
                onCommit={(value) => {
                  updateElement({ ...editingEl, text: value });
                  setEditingId(null);
                }}
                onCancel={() => {
                  // Échap : on rétablit le texte tel qu'il était au double-clic.
                  updateElement({
                    ...editingEl,
                    text: editOriginalTextRef.current,
                  });
                  setEditingId(null);
                }}
              />
            )}
          </div>
        </div>
        <p className="pt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Étiquette {widthCm} × {heightCm} cm — double-cliquez un texte pour
          l'éditer.
        </p>
      </div>
    </div>
  );
}
