#!/usr/bin/env python3
"""Serveur PoC « gomme magique » pour le configurateur.

Pipeline par image uploadée :
  1. BiRefNet (rembg, ONNX CPU) → alpha de détourage global, bords doux ;
  2. SAM 2.1 encode l'image UNE fois (l'étape lente) ; chaque clic ne passe
     ensuite que par le décodeur de masque (~50 ms CPU).

Un clic sur un morceau visible le retire du détourage (masque SAM soustrait
à l'alpha) ; un clic sur un morceau déjà retiré le réintègre. Aucun
étiquetage des parties : l'utilisateur désigne visuellement.

Lancement : .venv/bin/uvicorn server:app --port 8001   (cf. setup.sh)
Modèles surchargeables : SAM2_MODEL, REMBG_MODEL. Tout reste en mémoire,
pas de persistance (PoC).
"""

import io
import os
import threading
import uuid
from collections import OrderedDict
from dataclasses import dataclass, field

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps
from pydantic import BaseModel

SAM2_MODEL = os.environ.get("SAM2_MODEL", "facebook/sam2.1-hiera-large")
REMBG_MODEL = os.environ.get("REMBG_MODEL", "birefnet-general")
# Borne le côté long : maîtrise le temps CPU et la mémoire des embeddings.
MAX_SIDE = int(os.environ.get("MAX_SIDE", "2048"))
MAX_SESSIONS = int(os.environ.get("MAX_SESSIONS", "8"))
FEATHER_SIGMA = 1.2  # px : adoucit la frontière interne d'un morceau retiré


@dataclass
class EraserSession:
    arr: np.ndarray  # RGB HxW3
    base_alpha: np.ndarray  # uint8 HxW, alpha BiRefNet d'origine
    sam_state: dict  # features/_orig_hw du predictor pour cette image
    removed: list = field(default_factory=list)  # [{"id", "mask" (bool HxW)}]


sessions: OrderedDict[str, EraserSession] = OrderedDict()
# Une seule inférence torch/ONNX à la fois (CPU partagé, predictor global).
inference_lock = threading.Lock()

app = FastAPI(title="votrebougie — gomme magique (PoC)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Session-Id", "X-Removed-Count"],
)

# --- Modèles chargés une fois au démarrage, gardés en mémoire ---
print(f"Chargement de {REMBG_MODEL} (rembg) et {SAM2_MODEL} (SAM)…", flush=True)
import torch  # noqa: E402
from rembg import new_session, remove  # noqa: E402
from sam2.sam2_image_predictor import SAM2ImagePredictor  # noqa: E402

torch.set_num_threads(os.cpu_count() or 4)
rembg_session = new_session(REMBG_MODEL)
predictor = SAM2ImagePredictor.from_pretrained(SAM2_MODEL, device="cpu")
print("Modèles prêts.", flush=True)


def sam_save_state() -> dict:
    """Capture l'embedding de l'image courante du predictor (internes sam2 :
    accepté pour un PoC, à figer si l'API expose mieux un jour)."""
    return {"features": predictor._features, "orig_hw": predictor._orig_hw}


def sam_restore_state(state: dict) -> None:
    predictor._features = state["features"]
    predictor._orig_hw = state["orig_hw"]
    predictor._is_image_set = True
    predictor._is_batch = False


def compose_png(s: EraserSession) -> bytes:
    """PNG RGBA courant : alpha BiRefNet moins les morceaux retirés."""
    alpha = s.base_alpha.astype(np.float32) / 255.0
    for part in s.removed:
        cut = cv2.GaussianBlur(
            part["mask"].astype(np.float32), (0, 0), FEATHER_SIGMA
        )
        alpha = alpha * (1.0 - np.clip(cut, 0.0, 1.0))
    rgba = np.dstack([s.arr, (alpha * 255).astype(np.uint8)])
    buf = io.BytesIO()
    Image.fromarray(rgba).save(buf, format="PNG")
    return buf.getvalue()


def pick_part_mask(masks: np.ndarray, scores: np.ndarray, subject_px: int) -> np.ndarray:
    """SAM renvoie 3 candidats (sous-partie / partie / objet entier). Pour une
    gomme, on veut la « partie » : le masque le plus étendu dont le score
    reste proche du meilleur, sans engloutir le sujet entier (≤ 65 %). Le
    meilleur score seul choisirait souvent une sous-partie (ex. l'ornement
    du socle au lieu du socle)."""
    threshold = 0.85 * float(scores.max())
    candidates = [i for i in range(len(scores)) if scores[i] >= threshold]
    fitting = [i for i in candidates if masks[i].sum() <= 0.65 * subject_px]
    if fitting:
        return masks[max(fitting, key=lambda i: int(masks[i].sum()))]
    return masks[int(np.argmax(scores))]


def absorb_soft_halo(part_mask: np.ndarray, base_alpha: np.ndarray) -> np.ndarray:
    """Étend la découpe au liseré du contour extérieur qui borde le morceau.

    La frontière du masque SAM passe quelques pixels à l'intérieur de celle
    de l'alpha BiRefNet (qui est en plus adoucie) : sans cela, retirer un
    morceau qui touche le fond laisse une bordure fantôme à sa forme. On
    absorbe, près du morceau retiré, les pixels du sujet proches du fond
    (contour extérieur, bord d'image compris) ou semi-transparents —
    l'intérieur opaque du sujet (ex. la statue au-dessus du socle) est
    intouché."""
    k = max(3, round(0.004 * max(base_alpha.shape)))  # ~8 px à 2048
    kernel = np.ones((2 * k + 1, 2 * k + 1), np.uint8)
    dilated = cv2.dilate(part_mask.astype(np.uint8), kernel) > 0
    background = (base_alpha == 0).astype(np.uint8)
    background[0, :] = background[-1, :] = 1  # hors-cadre = fond (sujet coupé
    background[:, 0] = background[:, -1] = 1  # par le bord de l'image)
    near_background = cv2.dilate(background, kernel) > 0
    halo = dilated & (base_alpha > 0) & (near_background | (base_alpha < 250))
    return part_mask | halo


def clicked_component(mask: np.ndarray, x: int, y: int) -> np.ndarray:
    """Composante connexe sous le clic, trous d'épingle refermés."""
    m = cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    n, labels = cv2.connectedComponents(m, connectivity=8)
    if n <= 1:
        return m.astype(bool)
    label = labels[y, x]
    if label == 0:
        return m.astype(bool)
    return labels == label


def png_response(s: EraserSession, session_id: str) -> Response:
    return Response(
        content=compose_png(s),
        media_type="image/png",
        headers={
            "X-Session-Id": session_id,
            "X-Removed-Count": str(len(s.removed)),
            "Cache-Control": "no-store",
        },
    )


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "sessions": len(sessions), "sam": SAM2_MODEL}


@app.post("/sessions")
def create_session(image: UploadFile) -> Response:
    raw = image.file.read()
    try:
        img = ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert("RGB")
    except Exception as exc:
        raise HTTPException(400, f"image indécodable : {exc}") from exc
    img.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    arr = np.asarray(img)

    with inference_lock:
        mask = remove(img, session=rembg_session, only_mask=True)
        base_alpha = np.asarray(mask.convert("L"))
        with torch.inference_mode():
            predictor.set_image(arr)
            sam_state = sam_save_state()

    session_id = uuid.uuid4().hex
    sessions[session_id] = EraserSession(arr=arr, base_alpha=base_alpha, sam_state=sam_state)
    while len(sessions) > MAX_SESSIONS:  # éviction simple des plus anciennes
        sessions.popitem(last=False)
    return png_response(sessions[session_id], session_id)


class Click(BaseModel):
    # Coordonnées normalisées [0, 1] relatives à l'image affichée.
    x: float
    y: float


@app.post("/sessions/{session_id}/clicks")
def click(session_id: str, body: Click) -> Response:
    s = sessions.get(session_id)
    if s is None:
        raise HTTPException(404, "session inconnue ou expirée")
    h, w = s.base_alpha.shape
    px = min(max(int(body.x * w), 0), w - 1)
    py = min(max(int(body.y * h), 0), h - 1)

    # Clic sur un morceau déjà retiré → on le réintègre.
    for part in s.removed:
        if part["mask"][py, px]:
            s.removed.remove(part)
            return png_response(s, session_id)

    # Sinon : segment SAM sous le clic, soustrait du détourage.
    with inference_lock, torch.inference_mode():
        sam_restore_state(s.sam_state)
        masks, scores, _ = predictor.predict(
            point_coords=np.array([[px, py]]),
            point_labels=np.array([1]),
            multimask_output=True,
        )
    subject_px = int((s.base_alpha > 0).sum())
    part_mask = pick_part_mask(masks.astype(bool), scores, subject_px)
    part_mask = clicked_component(part_mask, px, py) & (s.base_alpha > 0)
    part_mask = absorb_soft_halo(part_mask, s.base_alpha)
    if part_mask.any():
        s.removed.append({"id": uuid.uuid4().hex, "mask": part_mask})
    return png_response(s, session_id)


@app.delete("/sessions/{session_id}", status_code=204)
def delete_session(session_id: str) -> None:
    sessions.pop(session_id, None)
