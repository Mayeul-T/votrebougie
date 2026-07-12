"use client";

import type Konva from "konva";
import { useCallback, useEffect, useRef, useState } from "react";
import { Layer, Rect, Stage, Transformer } from "react-konva";
import LabelImage from "./LabelImage";
import LabelText from "./LabelText";
import {
  type ImageElement,
  LABEL_FONT_FAMILY,
  type LabelElement,
  type TextElement,
} from "./types";

/** Résolution de travail de l'éditeur : 1 cm d'étiquette = 30 px de base. */
const PX_PER_CM = 30;
/** Largeur cible de la texture exportée, quel que soit l'affichage. */
const EXPORT_WIDTH = 1200;

export type LabelEditorProps = {
  /** Largeur physique de l'étiquette en cm. */
  widthCm: number;
  /** Hauteur physique de l'étiquette en cm. */
  heightCm: number;
  /** Reçoit la texture (dataURL PNG), débouncée à 500 ms. */
  onExport: (dataUrl: string) => void;
  className?: string;
};

export default function LabelEditor({
  widthCm,
  heightCm,
  onExport,
  className,
}: LabelEditorProps) {
  const baseW = widthCm * PX_PER_CM;
  const baseH = heightCm * PX_PER_CM;

  const [elements, setElements] = useState<LabelElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Bump quand une image finit de décoder : un export parti trop tôt
  // aurait figé un emplacement vide sur la bougie.
  const [imageTick, setImageTick] = useState(0);
  const [displayScale, setDisplayScale] = useState(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const contentLayerRef = useRef<Konva.Layer>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** objectURLs vivants, révoqués à la suppression de l'élément. */
  const objectUrlsRef = useRef(new Map<string, string>());
  const skipCommitRef = useRef(false);

  // --- L'éditeur suit la largeur de son conteneur ; les coordonnées des
  // éléments restent en pixels de base, seul le Stage est mis à l'échelle ---
  useEffect(() => {
    const wrap = containerRef.current;
    if (!wrap) return;
    const measure = () => {
      if (wrap.clientWidth > 0) setDisplayScale(wrap.clientWidth / baseW);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [baseW]);

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

  // --- Export débouncé : toute interaction finit par écrire dans
  // `elements`, cet effet est donc l'unique chemin de sortie ---
  // biome-ignore lint/correctness/useExhaustiveDependencies: elements et imageTick sont les déclencheurs de l'export
  useEffect(() => {
    const timer = setTimeout(() => {
      const layer = contentLayerRef.current;
      const stage = layer?.getStage();
      if (!layer || !stage) return;
      onExport(
        layer.toDataURL({
          x: 0,
          y: 0,
          width: stage.width(),
          height: stage.height(),
          // Compense l'échelle d'affichage : la texture fait toujours
          // EXPORT_WIDTH px de large, même après un resize de fenêtre.
          pixelRatio: EXPORT_WIDTH / stage.width(),
        }),
      );
    }, 500);
    return () => clearTimeout(timer);
  }, [elements, imageTick, onExport]);

  const updateElement = useCallback((updated: LabelElement) => {
    setElements((prev) =>
      prev.map((el) => (el.id === updated.id ? updated : el)),
    );
  }, []);

  const bumpImageTick = useCallback(() => setImageTick((t) => t + 1), []);

  const addText = () => {
    const el: TextElement = {
      id: crypto.randomUUID(),
      type: "text",
      text: "Votre texte",
      fontSize: 32,
      fill: "#1a1a1a",
      x: baseW / 2 - 90,
      y: baseH / 2 - 16,
      rotation: 0,
    };
    setElements((prev) => [...prev, el]);
    setSelectedId(el.id);
  };

  const addImage = (file: File) => {
    const src = URL.createObjectURL(file);
    // Préchargement pour connaître les dimensions naturelles.
    const probe = new window.Image();
    probe.onload = () => {
      const k = Math.min(
        1,
        (baseW * 0.6) / probe.width,
        (baseH * 0.6) / probe.height,
      );
      const width = probe.width * k;
      const height = probe.height * k;
      const el: ImageElement = {
        id: crypto.randomUUID(),
        type: "image",
        src,
        x: (baseW - width) / 2,
        y: (baseH - height) / 2,
        rotation: 0,
        width,
        height,
      };
      objectUrlsRef.current.set(el.id, src);
      setElements((prev) => [...prev, el]);
      setSelectedId(el.id);
    };
    probe.src = src;
  };

  const removeSelected = useCallback(() => {
    if (!selectedId || editingId) return;
    const url = objectUrlsRef.current.get(selectedId);
    if (url) {
      URL.revokeObjectURL(url);
      objectUrlsRef.current.delete(selectedId);
    }
    setElements((prev) => prev.filter((el) => el.id !== selectedId));
    setSelectedId(null);
  }, [selectedId, editingId]);

  // --- Suppression au clavier, neutralisée pendant l'édition de texte ---
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") removeSelected();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [removeSelected]);

  // --- Libère les objectURLs restants au démontage ---
  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => {
      for (const url of urls.values()) URL.revokeObjectURL(url);
    };
  }, []);

  const deselectOnEmpty = (
    e: Konva.KonvaEventObject<MouseEvent | TouchEvent>,
  ) => {
    // Le fond blanc est non-interactif : un clic dans le vide cible le Stage.
    if (e.target === e.target.getStage()) setSelectedId(null);
  };

  const commitText = (value: string) => {
    setElements((prev) =>
      prev.map((el) =>
        el.id === editingId && el.type === "text" ? { ...el, text: value } : el,
      ),
    );
    setEditingId(null);
  };

  const editingEl = elements.find(
    (el): el is TextElement => el.id === editingId && el.type === "text",
  );
  // Nœud Konva du texte en édition, pour caler le textarea sur ses métriques.
  const editingNode = editingEl
    ? (stageRef.current?.findOne(`#${editingEl.id}`) as Konva.Text | undefined)
    : undefined;

  const buttonClass =
    "rounded-full border border-zinc-300 px-4 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-40 disabled:hover:bg-transparent dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2 pb-3">
        <button
          type="button"
          className={buttonClass}
          onClick={() => fileInputRef.current?.click()}
        >
          + Image
        </button>
        <button type="button" className={buttonClass} onClick={addText}>
          + Texte
        </button>
        <button
          type="button"
          className={buttonClass}
          disabled={!selectedId}
          onClick={removeSelected}
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
            if (file) addImage(file);
          }}
        />
      </div>

      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-lg border border-zinc-300 shadow-sm dark:border-zinc-700"
      >
        <Stage
          ref={stageRef}
          width={baseW * displayScale}
          height={baseH * displayScale}
          scaleX={displayScale}
          scaleY={displayScale}
          onMouseDown={deselectOnEmpty}
          onTouchStart={deselectOnEmpty}
        >
          <Layer ref={contentLayerRef}>
            <Rect
              x={0}
              y={0}
              width={baseW}
              height={baseH}
              fill="#ffffff"
              listening={false}
            />
            {elements.map((el) =>
              el.type === "image" ? (
                <LabelImage
                  key={el.id}
                  element={el}
                  onSelect={() => setSelectedId(el.id)}
                  onChange={updateElement}
                  onLoaded={bumpImageTick}
                />
              ) : (
                <LabelText
                  key={el.id}
                  element={el}
                  isEditing={el.id === editingId}
                  onSelect={() => setSelectedId(el.id)}
                  onChange={updateElement}
                  onStartEdit={() => {
                    setSelectedId(el.id);
                    setEditingId(el.id);
                  }}
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

        {editingEl && (
          <textarea
            // PoC : le textarea approxime les métriques texte de Konva,
            // une légère dérive visuelle pendant la frappe est acceptée.
            // biome-ignore lint/a11y/noAutofocus: l'édition vient d'être demandée au double-clic
            autoFocus
            defaultValue={editingEl.text}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.blur();
              } else if (e.key === "Escape") {
                skipCommitRef.current = true;
                e.currentTarget.blur();
              }
            }}
            onBlur={(e) => {
              const skip = skipCommitRef.current;
              skipCommitRef.current = false;
              if (skip) setEditingId(null);
              else commitText(e.currentTarget.value);
            }}
            className="absolute m-0 resize-none overflow-hidden border-none bg-transparent p-0 outline-none"
            style={{
              top: editingEl.y * displayScale,
              left: editingEl.x * displayScale,
              width:
                Math.max(editingNode?.width() ?? 0, editingEl.fontSize * 6) *
                displayScale,
              height:
                ((editingNode?.height() ?? editingEl.fontSize) + 4) *
                displayScale,
              fontSize: editingEl.fontSize * displayScale,
              lineHeight: 1,
              fontFamily: LABEL_FONT_FAMILY,
              color: editingEl.fill,
              transform: `rotate(${editingEl.rotation}deg)`,
              transformOrigin: "top left",
            }}
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
