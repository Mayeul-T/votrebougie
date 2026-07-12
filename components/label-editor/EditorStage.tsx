"use client";

import type Konva from "konva";
import { type RefObject, useEffect, useRef } from "react";
import { Layer, Rect, Stage, Transformer } from "react-konva";
import LabelImage from "./elements/LabelImage";
import LabelText from "./elements/LabelText";
import useAlignmentGuides from "./hooks/useAlignmentGuides";
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
  const guidesLayerRef = useRef<Konva.Layer>(null);

  const alignmentGuides = useAlignmentGuides({
    contentLayerRef,
    guidesLayerRef,
    baseWidth,
    baseHeight,
    displayScale,
  });

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
      {/* Fond blanc de travail : visible dans l'éditeur seulement.
          L'étiquette imprimée est transparente, donc la couche exportée
          (contentLayerRef) ne contient que les éléments. */}
      <Layer listening={false}>
        <Rect
          x={0}
          y={0}
          width={baseWidth}
          height={baseHeight}
          fill="#ffffff"
        />
      </Layer>
      <Layer
        ref={contentLayerRef}
        onDragMove={alignmentGuides.onDragMove}
        onDragEnd={alignmentGuides.clearGuides}
      >
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
      {/* Couches UI séparées : guides et poignées ne sont jamais exportés,
          l'export ne lisant que la couche de contenu. */}
      <Layer ref={guidesLayerRef} listening={false} />
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
          onTransform={() => {
            // Les guides s'affichent aussi pendant le resize, sur le nœud
            // en cours de transformation.
            const node = trRef.current?.nodes()[0];
            if (node) alignmentGuides.onTransformMove(node);
          }}
          onTransformEnd={alignmentGuides.clearGuides}
          anchorDragBoundFunc={(_oldPos, newPos) => {
            const tr = trRef.current;
            const anchor = tr?.getActiveAnchor();
            // Pas d'accrochage pour la poignée de rotation.
            if (!tr || !anchor || anchor === "rotater") return newPos;
            return alignmentGuides.boundAnchor(newPos, tr.nodes()[0], anchor);
          }}
        />
      </Layer>
    </Stage>
  );
}
