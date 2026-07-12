"use client";

import type Konva from "konva";
import { Text } from "react-konva";
import type { TextElement } from "../types";

/** Konva combine gras et italique dans un seul attribut `fontStyle`. */
export function toFontStyle(element: TextElement): string {
  const parts = [];
  if (element.italic) parts.push("italic");
  if (element.bold) parts.push("bold");
  return parts.join(" ") || "normal";
}

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
      fontFamily={element.fontFamily}
      fontStyle={toFontStyle(element)}
      textDecoration={element.underline ? "underline" : ""}
      align={element.align}
      width={element.width}
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
        // Le scale du Transformer devient une taille de police (et une
        // largeur de bloc s'il y en a une) : le texte reste net.
        const node = e.target as Konva.Text;
        const fontSize = Math.max(
          6,
          Math.round(element.fontSize * node.scaleY()),
        );
        const width = element.width ? element.width * node.scaleX() : undefined;
        node.scaleX(1);
        node.scaleY(1);
        onChange({
          ...element,
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          fontSize,
          width,
        });
      }}
    />
  );
}
