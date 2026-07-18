#!/usr/bin/env python3
"""PoC de détourage : lit les images de in/, segmente le sujet au point
central avec SAM 2.1 (CPU), écrit un PNG RGBA détouré dans out/.

Bords durs par défaut (vitraux, statues) : masque binaire nettoyé + léger
anti-crénelage. Pas d'alpha matting à ce stade.

Usage : .venv/bin/python detoure.py
Modèle surchargeable : SAM2_MODEL=facebook/sam2.1-hiera-small ... (plus rapide)
"""

import json
import os
import sys
import time
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageOps

MODEL_ID = os.environ.get("SAM2_MODEL", "facebook/sam2.1-hiera-large")
IN_DIR = Path(os.environ.get("IN_DIR", "in"))
OUT_DIR = Path(os.environ.get("OUT_DIR", "out"))
# point = clic simulé au centre ; box = boîte centrée couvrant ~76 % de l'image
# (simule un cadrage grossier du sujet — bien plus robuste sur les vitraux,
# dont les plombs cloisonnent la segmentation par point) ; annotations = boîte
# et points par image lus depuis ANNOTATIONS (coordonnées normalisées 0-1),
# repli boîte+point centré si une image n'y figure pas
PROMPT_MODE = os.environ.get("PROMPT_MODE", "point")
ANNOTATIONS = Path(os.environ.get("ANNOTATIONS", "annotations.json"))
EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}
FEATHER_SIGMA = 1.2  # px : anti-crénelage du bord, le détourage reste « dur »


def load_predictor():
    # imports tardifs : message d'erreur clair si l'environnement n'est pas installé
    import torch
    from sam2.sam2_image_predictor import SAM2ImagePredictor

    torch.set_num_threads(os.cpu_count() or 4)
    return SAM2ImagePredictor.from_pretrained(MODEL_ID, device="cpu")


def pick_mask(masks: np.ndarray, scores: np.ndarray) -> np.ndarray:
    """SAM renvoie 3 masques (sous-partie / partie / objet entier). Le meilleur
    score seul favorise souvent une sous-partie (ex. la robe sans la tête) :
    on préfère le masque le plus étendu dont le score reste proche du meilleur."""
    threshold = 0.85 * float(scores.max())
    candidates = [i for i in range(len(scores)) if scores[i] >= threshold]
    return masks[max(candidates, key=lambda i: masks[i].sum())]


def clean_mask(mask: np.ndarray, point: tuple[int, int]) -> np.ndarray:
    """Ne garde que la composante connexe sous le clic, ferme les trous d'épingle."""
    m = cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    n, labels, stats, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
    if n <= 1:
        return m
    label = labels[point[1], point[0]]
    if label == 0:  # le clic tombe hors masque après nettoyage : plus grande composante
        label = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    return (labels == label).astype(np.uint8)


def cutout(arr: np.ndarray, mask: np.ndarray) -> np.ndarray:
    alpha = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), FEATHER_SIGMA)
    alpha = (np.clip(alpha, 0.0, 1.0) * 255).astype(np.uint8)
    return np.dstack([arr, alpha])


def main() -> None:
    images = sorted(p for p in IN_DIR.iterdir() if p.suffix.lower() in EXTS) if IN_DIR.is_dir() else []
    if not images:
        sys.exit(f"Aucune image dans {IN_DIR}/")
    OUT_DIR.mkdir(exist_ok=True)

    t0 = time.perf_counter()
    predictor = load_predictor()
    print(f"Modèle {MODEL_ID} chargé en {time.perf_counter() - t0:.1f}s (CPU)")

    import torch

    annotations = {}
    if PROMPT_MODE == "annotations" and ANNOTATIONS.exists():
        annotations = json.loads(ANNOTATIONS.read_text())

    for path in images:
        t0 = time.perf_counter()
        image = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
        arr = np.asarray(image)
        h, w = arr.shape[:2]
        center = (w // 2, h // 2)

        prompt = {}
        annotation = annotations.get(path.name)
        if annotation:
            x0, y0, x1, y1 = annotation["box"]
            prompt["box"] = np.array([x0 * w, y0 * h, x1 * w, y1 * h])
            points = [(px * w, py * h) for px, py in annotation.get("pos", [])]
            labels = [1] * len(points)
            for px, py in annotation.get("neg", []):
                points.append((px * w, py * h))
                labels.append(0)
            if points:
                prompt["point_coords"] = np.array(points)
                prompt["point_labels"] = np.array(labels)
                center = (int(points[0][0]), int(points[0][1]))
        elif PROMPT_MODE == "annotations":  # repli : boîte + point centrés
            prompt["box"] = np.array([w * 0.12, h * 0.12, w * 0.88, h * 0.88])
            prompt["point_coords"] = np.array([center])
            prompt["point_labels"] = np.array([1])
        else:
            if "box" in PROMPT_MODE:
                prompt["box"] = np.array([w * 0.12, h * 0.12, w * 0.88, h * 0.88])
            if "point" in PROMPT_MODE:
                prompt["point_coords"] = np.array([center])
                prompt["point_labels"] = np.array([1])
        with torch.inference_mode():
            predictor.set_image(arr)
            masks, scores, _ = predictor.predict(multimask_output=True, **prompt)
        mask = clean_mask(pick_mask(masks, scores), center)
        out_path = OUT_DIR / f"{path.stem}.png"
        Image.fromarray(cutout(arr, mask)).save(out_path)
        print(
            f"{path.name} ({w}×{h}) → {out_path.name} : "
            f"{time.perf_counter() - t0:.1f}s, sujet {100 * mask.mean():.0f}% de l'image, "
            f"score {scores.max():.2f}"
        )


if __name__ == "__main__":
    main()
