"use client";

import type Konva from "konva";
import { Text } from "react-konva";
import { LABEL_FONT_FAMILY, type TextElement } from "../types";

export default function LabelText({
  element,
  isEditing,
  onSelect,
  onChange,
  onStartEdit,
}: {
  element: TextElement;
  /** Masqué pendant l'édition : le textarea superposé prend le relais. */
  isEditing: boolean;
  onSelect: () => void;
  onChange: (element: TextElement) => void;
  onStartEdit: () => void;
}) {
  return (
    <Text
      id={element.id}
      x={element.x}
      y={element.y}
      text={element.text}
      fontSize={element.fontSize}
      fontFamily={LABEL_FONT_FAMILY}
      fill={element.fill}
      rotation={element.rotation}
      visible={!isEditing}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDblClick={onStartEdit}
      onDblTap={onStartEdit}
      onDragEnd={(e) =>
        onChange({ ...element, x: e.target.x(), y: e.target.y() })
      }
      onTransformEnd={(e) => {
        // Le scale du Transformer devient une taille de police : le texte
        // reste net quel que soit l'agrandissement.
        const node = e.target as Konva.Text;
        const fontSize = Math.max(
          6,
          Math.round(element.fontSize * node.scaleY()),
        );
        node.scaleX(1);
        node.scaleY(1);
        onChange({
          ...element,
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          fontSize,
        });
      }}
    />
  );
}
