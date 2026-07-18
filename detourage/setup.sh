#!/usr/bin/env bash
# Installe l'environnement du PoC (CPU uniquement — pas de CUDA sur le mini PC).
set -euo pipefail
cd "$(dirname "$0")"

python3 -m venv .venv
.venv/bin/pip install --upgrade pip
# torch CPU d'abord : sinon les dépendances de sam2 tireraient le build CUDA (~2,5 Go)
.venv/bin/pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
.venv/bin/pip install "git+https://github.com/facebookresearch/sam2.git" \
  opencv-python-headless pillow numpy huggingface_hub
# Serveur gomme magique : BiRefNet (rembg/ONNX) + API HTTP
.venv/bin/pip install "rembg[cpu]" fastapi uvicorn python-multipart

mkdir -p in out
echo "OK. Batch : déposer des images dans in/ puis .venv/bin/python detoure.py"
echo "Serveur gomme magique : .venv/bin/uvicorn server:app --port 8001"
