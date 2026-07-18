# Détourage — PoC

Deux outils CPU-only (pas de CUDA sur le mini PC cible) :

- **`detoure.py`** — batch : segmentation SAM 2.1 des images de `in/` vers
  `out/` (clic central simulé, ou boîtes/points via `annotations.json`).
- **`server.py`** — serveur « gomme magique » du configurateur :
  BiRefNet détoure l'image uploadée (bords doux), SAM 2.1 encode l'image
  une fois, puis chaque clic retire/réintègre le morceau cliqué (~50 ms).

```bash
detourage/setup.sh             # venv + torch CPU + sam2 + rembg + fastapi (une fois)

# Batch
cp mes-photos/*.jpg in/        # in/ et out/ relatifs au répertoire courant
detourage/.venv/bin/python detourage/detoure.py   # écrit out/<nom>.png

# Serveur gomme magique (attendu par le configurateur sur le port 8001)
cd detourage && .venv/bin/uvicorn server:app --port 8001
```

Premier lancement : télécharge les poids (SAM ~900 Mo hiera-large,
BiRefNet ~970 Mo) depuis Hugging Face / GitHub. Variables :
`SAM2_MODEL=facebook/sam2.1-hiera-small` (encodage 1,6 s au lieu de 7 s),
`REMBG_MODEL`, `MAX_SIDE` (défaut 2048), `MAX_SESSIONS` (défaut 8).

## API du serveur

- `POST /sessions` (multipart `image`) → PNG RGBA détouré ;
  l'en-tête `X-Session-Id` identifie la session (embedding SAM en cache).
- `POST /sessions/{id}/clicks` (`{"x": 0-1, "y": 0-1}`) → PNG mis à jour.
  Clic sur un morceau visible : il est retiré ; sur un morceau retiré :
  il est réintégré. Aucun étiquetage des parties.
- `DELETE /sessions/{id}` — libère la session (sinon éviction LRU).

Tout est en mémoire, mono-inférence (verrou global) : PoC, pas un service
de production. Étapes suivantes (cf. `algorithme détourage.md` à la
racine) : persistance des sessions, file d'attente, authentification,
tunnel Cloudflare vers le mini PC.
