"use client";

import type Konva from "konva";
import { type RefObject, useEffect, useRef } from "react";
import { Layer, Rect, Stage, Transformer } from "react-konva";
import LabelImage from "./elements/LabelImage";
import LabelText from "./elements/LabelText";
import type { LabelElement } from "./types";

/**
 * La surface d'édition : Stage Konva, fond blanc, éléments, sélection.
 * La couche UI (Transformer) est séparée de la couche de contenu pour
 * que les poignées ne soient jamais exportées dans la texture.
 */
export default function EditorStage({
  baseWidth,
  baseHeight,
  displayScale,
  elements,
  selectedId,
  editingId,
  onSelect,
  onDeselect,
  onStartEdit,
  onElementChange,
  onImageLoaded,
  stageRef,
  contentLayerRef,
}: {
  baseWidth: number;
  baseHeight: number;
  displayScale: number;
  elements: LabelElement[];
  selectedId: string | null;
  editingId: string | null;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  onStartEdit: (id: string) => void;
  onElementChange: (element: LabelElement) => void;
  onImageLoaded: () => void;
  stageRef: RefObject<Konva.Stage | null>;
  contentLayerRef: RefObject<Konva.Layer | null>;
}) {
  const trRef = useRef<Konva.Transformer>(null);

  // --- Sélection : le Transformer suit l'élément sélectionné ---
  // biome-ignore lint/correctness/useExhaustiveDependencies: elements re-cale le Transformer après un redimensionnement (fontSize, etc.)
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node =
      selectedId && selectedId !== editingId
        ? tr.getStage()?.findOne(`#${selectedId}`)
        : null;
    tr.nodes(node ? [node] : []);
  }, [selectedId, editingId, elements]);

  const deselectOnEmpty = (
    e: Konva.KonvaEventObject<MouseEvent | TouchEvent>,
  ) => {
    // Le fond blanc est non-interactif : un clic dans le vide cible le Stage.
    if (e.target === e.target.getStage()) onDeselect();
  };

  return (
    <Stage
      ref={stageRef}
      width={baseWidth * displayScale}
      height={baseHeight * displayScale}
      scaleX={displayScale}
      scaleY={displayScale}
      onMouseDown={deselectOnEmpty}
      onTouchStart={deselectOnEmpty}
    >
      <Layer ref={contentLayerRef}>
        <Rect
          x={0}
          y={0}
          width={baseWidth}
          height={baseHeight}
          fill="#ffffff"
          listening={false}
        />
        {elements.map((el) =>
          el.type === "image" ? (
            <LabelImage
              key={el.id}
              element={el}
              onSelect={() => onSelect(el.id)}
              onChange={onElementChange}
              onLoaded={onImageLoaded}
            />
          ) : (
            <LabelText
              key={el.id}
              element={el}
              isEditing={el.id === editingId}
              onSelect={() => onSelect(el.id)}
              onChange={onElementChange}
              onStartEdit={() => onStartEdit(el.id)}
            />
          ),
        )}
      </Layer>
      {/* Couche UI séparée : les poignées ne sont jamais exportées. */}
      <Layer>
        <Transformer
          ref={trRef}
          rotateEnabled
          keepRatio
          enabledAnchors={[
            "top-left",
            "top-right",
            "bottom-left",
            "bottom-right",
          ]}
        />
      </Layer>
    </Stage>
  );
}
