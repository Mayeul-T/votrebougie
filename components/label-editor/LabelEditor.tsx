import type Konva from "konva";
import { useCallback, useEffect, useRef, useState } from "react";
import EditorStage from "./EditorStage";
import EditorToolbox from "./EditorToolbox";
import useDebouncedExport from "./hooks/useDebouncedExport";
import useDeleteKey from "./hooks/useDeleteKey";
import useDisplayScale from "./hooks/useDisplayScale";
import useLabelDocument from "./hooks/useLabelDocument";
import MagicEraserPanel, { type EraserStatus } from "./MagicEraserPanel";
import {
  clickEraserSession,
  createEraserSession,
  deleteEraserSession,
} from "./magicEraser";
import TextEditOverlay from "./TextEditOverlay";
import TextToolbox from "./TextToolbox";
import type { ImageElement, TextElement } from "./types";

/** Résolution de travail de l'éditeur : 1 mm d'étiquette = 3 px de base. */
const PX_PER_MM = 3;

export type LabelEditorProps = {
  /** Largeur physique de l'étiquette en mm. */
  widthMm: number;
  /** Hauteur physique de l'étiquette en mm. */
  heightMm: number;
  /** Reçoit la texture (dataURL PNG), débouncée à 500 ms. */
  onExport: (dataUrl: string) => void;
  /** Signale si le document contient des éléments (pour avertir avant reset). */
  onContentChange?: (hasContent: boolean) => void;
  className?: string;
};

/**
 * Assemblage de l'éditeur : le document (useLabelDocument), l'état UI
 * (sélection, édition), et les sous-composants toolbox / stage / overlay.
 */
export default function LabelEditor({
  widthMm,
  heightMm,
  onExport,
  onContentChange,
  className,
}: LabelEditorProps) {
  const baseWidth = widthMm * PX_PER_MM;
  const baseHeight = heightMm * PX_PER_MM;

  // --- État UI, volontairement hors du document (futur historique undo) ---
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Bump quand une image finit de décoder : un export parti trop tôt
  // aurait figé un emplacement vide sur la bougie.
  const [imageTick, setImageTick] = useState(0);
  // Sessions gomme magique par élément image (état UI : non sérialisé).
  const [eraserSessions, setEraserSessions] = useState<
    Record<string, { sessionId?: string; status: EraserStatus; busy: boolean }>
  >({});
  const eraserSessionsRef = useRef(eraserSessions);
  eraserSessionsRef.current = eraserSessions;

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const contentLayerRef = useRef<Konva.Layer>(null);
  /** Texte au moment du double-clic, restauré si l'édition est annulée. */
  const editOriginalTextRef = useRef<string>("");
  const editingIdRef = useRef<string | null>(null);
  editingIdRef.current = editingId;

  const displayScale = useDisplayScale(containerRef, baseWidth);

  // Dès l'upload : détourage BiRefNet + encodage SAM côté serveur, puis le
  // PNG détouré remplace l'original (la bougie se met à jour via l'export).
  const handleImageFileAdded = useCallback((id: string, file: File) => {
    setEraserSessions((prev) => ({
      ...prev,
      [id]: { status: "processing", busy: false },
    }));
    createEraserSession(file)
      .then(({ sessionId, blob }) => {
        // Élément supprimé pendant le détourage : on libère la session.
        if (!eraserSessionsRef.current[id]) {
          deleteEraserSession(sessionId);
          return;
        }
        setImageBlobRef.current(id, blob);
        setEraserSessions((prev) =>
          prev[id]
            ? { ...prev, [id]: { sessionId, status: "ready", busy: false } }
            : prev,
        );
      })
      .catch(() => {
        setEraserSessions((prev) =>
          prev[id] ? { ...prev, [id]: { status: "error", busy: false } } : prev,
        );
      });
  }, []);

  const {
    elements,
    addText,
    addImageFromFile,
    updateElement,
    setImageBlob,
    removeElement,
  } = useLabelDocument({
    baseWidth,
    baseHeight,
    onElementAdded: setSelectedId,
    onImageFileAdded: handleImageFileAdded,
  });
  const setImageBlobRef = useRef(setImageBlob);
  setImageBlobRef.current = setImageBlob;

  const handleEraserClick = useCallback((id: string, x: number, y: number) => {
    const entry = eraserSessionsRef.current[id];
    if (!entry?.sessionId || entry.busy) return;
    setEraserSessions((prev) => ({ ...prev, [id]: { ...entry, busy: true } }));
    clickEraserSession(entry.sessionId, x, y)
      .then((blob) => {
        if (eraserSessionsRef.current[id]) setImageBlobRef.current(id, blob);
      })
      .catch(() => {})
      .finally(() => {
        setEraserSessions((prev) =>
          prev[id] ? { ...prev, [id]: { ...prev[id], busy: false } } : prev,
        );
      });
  }, []);

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

  const hasContent = elements.length > 0;
  useEffect(() => {
    onContentChange?.(hasContent);
  }, [hasContent, onContentChange]);

  const removeSelected = useCallback(() => {
    if (!selectedId || editingId) return;
    const session = eraserSessionsRef.current[selectedId];
    if (session?.sessionId) deleteEraserSession(session.sessionId);
    setEraserSessions(({ [selectedId]: _, ...rest }) => rest);
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
  // Image sélectionnée → l'éditeur « gomme magique » apparaît en grand.
  const selectedImageEl = elements.find(
    (el): el is ImageElement => el.id === selectedId && el.type === "image",
  );
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
          Étiquette {widthMm} × {heightMm} mm — double-cliquez un texte pour
          l'éditer.
        </p>

        {selectedImageEl && (
          <MagicEraserPanel
            element={selectedImageEl}
            status={eraserSessions[selectedImageEl.id]?.status ?? "unavailable"}
            busy={eraserSessions[selectedImageEl.id]?.busy ?? false}
            onClickPoint={(x, y) => handleEraserClick(selectedImageEl.id, x, y)}
          />
        )}
      </div>
    </div>
  );
}
