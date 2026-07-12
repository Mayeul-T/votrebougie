import type Konva from "konva";
import { useCallback, useRef, useState } from "react";
import EditorStage from "./EditorStage";
import EditorToolbox from "./EditorToolbox";
import useDebouncedExport from "./hooks/useDebouncedExport";
import useDeleteKey from "./hooks/useDeleteKey";
import useDisplayScale from "./hooks/useDisplayScale";
import useLabelDocument from "./hooks/useLabelDocument";
import TextEditOverlay from "./TextEditOverlay";
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

  const displayScale = useDisplayScale(containerRef, baseWidth);

  const { elements, addText, addImageFromFile, updateElement, removeElement } =
    useLabelDocument({ baseWidth, baseHeight, onElementAdded: setSelectedId });

  useDebouncedExport({
    layerRef: contentLayerRef,
    onExport,
    triggers: [elements, imageTick],
  });

  const removeSelected = useCallback(() => {
    if (!selectedId || editingId) return;
    removeElement(selectedId);
    setSelectedId(null);
  }, [selectedId, editingId, removeElement]);

  // Suppression clavier, neutralisée pendant l'édition via removeSelected.
  useDeleteKey(removeSelected);

  const bumpImageTick = useCallback(() => setImageTick((t) => t + 1), []);

  const editingEl = elements.find(
    (el): el is TextElement => el.id === editingId && el.type === "text",
  );
  // Nœud Konva du texte en édition, pour caler le textarea sur ses métriques.
  const editingNode = editingEl
    ? (stageRef.current?.findOne(`#${editingEl.id}`) as Konva.Text | undefined)
    : undefined;

  return (
    <div className={className}>
      <EditorToolbox
        onAddImage={addImageFromFile}
        onAddText={addText}
        onRemoveSelected={removeSelected}
        canRemove={selectedId !== null}
      />

      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-lg border border-zinc-300 shadow-sm dark:border-zinc-700"
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
            onCommit={(value) => {
              updateElement({ ...editingEl, text: value });
              setEditingId(null);
            }}
            onCancel={() => setEditingId(null)}
          />
        )}
      </div>
      <p className="pt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Étiquette {widthCm} × {heightCm} cm — double-cliquez un texte pour
        l'éditer.
      </p>
    </div>
  );
}
