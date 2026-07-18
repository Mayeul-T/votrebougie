  # Votre Bougie — Documentation technique

## Stack et commandes

Next.js 16.2 (App Router, **Turbopack par défaut** — pas de flag,
`next.config.ts` vide), React 19.2, TypeScript, Tailwind v4, Biome (lint +
format), **bun** (lockfile `bun.lock` ; `trustedDependencies` pour les
postinstall natifs de sharp/unrs-resolver). Canvas 2D : konva 10 +
react-konva 19. 3D : three.js. Modales : @radix-ui/react-alert-dialog.

```bash
bun dev          # serveur de dev (souvent déjà lancé sur le port 3000)
bun test         # runner bun:test intégré (aucun script package.json) — snapping.test.ts
bun run lint     # biome check (.claude/ exclu via biome.json)
bun run format   # biome format --write
bun run build    # build prod : valide aussi la SSR-safety de Konva
```

Biome : ignore basé sur `.gitignore` (`vcs.useIgnoreFile`), `.claude/`
exclu, `noUnknownAtRules` désactivée (at-rules Tailwind v4 de
`globals.css`), domaines next/react en recommended.

MCP disponible : `konva-documentation` (doc Konva interrogeable, cf.
`.mcp.json`). La doc Next.js embarquée (version modifiée !) est dans
`node_modules/next/dist/docs/`.

## Arborescence

```
app/layout.tsx                      RootLayout : fontes Geist, metadata, globals.css
app/page.tsx                        Server Component : titre + <CandleConfigurator/>
components/
  CandleViewer.tsx                  Aperçu 3D three.js (client), unités mm
  candle-configurator/
    CandleConfigurator.tsx          Assemblage : Provider + Select + Viewer + Editor
    CandleTemplateContext.tsx       Contexte du template actif (futur fetch BDD ; repli 1er preset si id inconnu)
    TemplateSelect.tsx              Sélecteur + modale de confirmation (Radix)
    templates.ts                    Presets CandleTemplate (JSON pur, mm)
  label-editor/
    LabelEditor.tsx                 Assemblage : hooks + toolbars + stage + overlay
    EditorStage.tsx                 Stage/couches Konva, sélection, Transformer
    EditorToolbox.tsx               + Image / + Texte / Supprimer (présentation pure)
    TextToolbox.tsx                 Barre contextuelle texte (police, taille, couleur, B/I/U, alignements)
    TextEditOverlay.tsx             Textarea superposé (édition au double-clic)
    MagicEraserPanel.tsx            Panneau gomme magique (image sélectionnée en grand, clics)
    magicEraser.ts                  Client HTTP du serveur de détourage (sessions, clics)
    types.ts                        Modèle LabelElement (union image/texte) + FONT_FAMILIES
    snapping.ts                     Géométrie PURE : stops, accrochage, clamp, AABB pivotée
    snapping.test.ts                Tests bun:test du module pur
    elements/LabelImage.tsx         Nœud Konva image (bake du scale au transform, min 8 px)
    elements/LabelText.tsx          Nœud Konva texte (scale → fontSize, styles)
    hooks/useLabelDocument.ts       useReducer du document + cycle de vie des objectURLs
    hooks/useDebouncedExport.ts     Export texture débouncé 500 ms (+ hook `prepare`)
    hooks/useAlignmentGuides.ts     Guides magnétiques drag/resize + clamp (impératif)
    hooks/useDisplayScale.ts        ResizeObserver → échelle d'affichage
    hooks/useHtmlImage.ts           Chargement HTMLImageElement pour Konva
    hooks/useDeleteKey.ts           Suppr/Retour arrière (ignore les champs de saisie)
detourage/
  server.py                         Serveur FastAPI gomme magique (BiRefNet + SAM 2.1, CPU, port 8001)
  detoure.py                        Batch de détourage SAM (PoC historique, cf. detourage/README.md)
```

## Flux de données

```
CandleTemplateProvider (template actif, mm)
  └─ ConfiguratorContent
       ├─ LabelEditor (key=template.id → remonté à chaque changement de modèle)
       │    useLabelDocument (useReducer) → elements
       │    → EditorStage (react-konva) rend les éléments
       │    → useDebouncedExport : 500 ms après tout déclencheur
       │      (elements + imageTick, bumpé quand une image finit de
       │      décoder — sinon un export parti trop tôt figerait un
       │      emplacement vide sur la texture),
       │      contentLayer.toDataURL (PNG alpha, largeur EXPORT_WIDTH=1200)
       │    → onExport(dataUrl) remonte au configurateur
       └─ CandleViewer label.imageUrl=dataUrl
            → effet étiquette : TextureLoader → échange du mesh seul
              (jamais de rebuild de scène → la caméra ne saute pas)
```

- **Systèmes d'unités** : physique en **mm** (templates, props Viewer/Editor).
  Éditeur : « pixels de base » = `PX_PER_MM = 3` (étiquette 200×70 mm →
  600×210 px). Le Stage est affiché à `displayScale = largeurConteneur /
  largeurBase` (via `useDisplayScale`) ; les coordonnées des éléments restent
  en pixels de base, seul le Stage est scalé. Scène 3D : 1 unité = 50 mm
  (`MM = 1/50` dans CandleViewer).
- L'export compense l'échelle (`pixelRatio = EXPORT_WIDTH / stage.width()`)
  → texture toujours ~1200 px de large. Sur la bougie, l'angle enveloppé est
  déduit du ratio de l'image : `thetaLength = aspect × hauteur / rayon`,
  borné à 2π (une étiquette plus large que la circonférence est plafonnée à
  un tour) ; le cylindre étiquette est décalé de +0,2 mm au-dessus du
  support contre le z-fighting.
- Changement de template : reset **synchrone** de `labelDataUrl` pendant le
  rendu (pattern `prevTemplateId`) pour ne pas afficher une frame de
  l'ancienne texture, + remount de l'éditeur via `key`.
- **Gomme magique** : à l'upload, `LabelEditor` poste l'image au serveur
  local (`NEXT_PUBLIC_MAGIC_ERASER_URL`, défaut `http://localhost:8001`) —
  BiRefNet détoure (alpha doux) et SAM 2.1 encode l'image une fois ; le PNG
  détouré remplace le `src` de l'élément (`setImageBlob`, action `setSrc` du
  reducer, géométrie inchangée car mêmes dimensions). Chaque clic dans le
  panneau envoie `{x, y}` normalisés → décodeur SAM (~50 ms) → le morceau
  cliqué est soustrait de (ou réintégré à) l'alpha → nouveau PNG → nouveau
  `src` → `useHtmlImage` recharge → `imageTick` → export → bougie. L'état
  des sessions (`sessionId`, `processing/ready/error`, `busy`) vit dans
  `LabelEditor` (état UI non sérialisé) ; la suppression d'un élément
  libère sa session (`DELETE`, éviction LRU côté serveur en repli).

## Décisions structurantes (et pourquoi)

- **Document vs état UI** : `elements` vit dans un `useReducer`
  (`useLabelDocument`, actions add/update/remove) — sérialisable, prêt pour
  undo/redo et persistance. `selectedId`/`editingId` restent des `useState`
  dans `LabelEditor` : l'état UI ne polluera pas un futur historique. Les
  objectURLs des images sont créés et révoqués par le hook (à la
  suppression / au démontage) mais leur **valeur** vit dans le modèle
  (champ `src`) — c'est elle que la persistance devra remplacer par un
  upload.
- **4 couches Konva** dans `EditorStage`, dans l'ordre : fond blanc
  (`listening=false`, NON exporté — l'étiquette imprimée est transparente),
  contenu (`contentLayerRef`, la seule exportée), guides (`listening=false`),
  Transformer. Règle : la couche de contenu ne contient QUE ce qui s'imprime.
- **Guides/accrochage** : logique pure dans `snapping.ts` (testée), rendu
  impératif dans `useAlignmentGuides` (les `dragmove`/`transform` tirent à
  ~60 Hz : pas de re-render React, on détruit/recrée des `Konva.Line` dans la
  couche guides). Handlers drag posés sur la **couche** contenu (bubbling
  Konva), handlers transform sur le Transformer ; zéro câblage des guides
  dans les éléments. Stops de l'étiquette asymétriques : quarts + centre en
  largeur, centre seul en hauteur. Seuil d'accrochage 5 px **écran**
  (reconverti en px de base via `displayScale`) ; lignes en
  `strokeScaleEnabled: false` (épaisseur/pointillés constants à l'écran).
- **Accrochage au resize** : `anchorDragBoundFunc` du Transformer. Piège
  `keepRatio` : le Transformer reprojette la poignée sur la diagonale du
  ratio, ce qui défait un accrochage naïf par axe → on pose l'axe accroché
  sur le stop et on recalcule l'autre depuis le **coin fixe** avec le ratio
  (repli par-axe si le nœud est pivoté). Coordonnées absolues ↔ base via
  `layer.getAbsoluteTransform()`.
- **Bornage dans l'étiquette** : drag = clamp de l'AABB après accrochage
  (`clampRectToBounds`) ; resize/rotation = `boundBoxFunc` qui rejette toute
  boîte dont l'AABB (`rotatedBoxAABB`, rotation en radians) sort du Stage
  (tolérance 0,5 px). Pas de stops de guides sur les bords : la butée suffit.
- **Édition de texte** : pattern Konva officiel (textarea superposé, nœud
  `visible=false` pendant l'édition). Le textarea sélectionne tout au focus,
  suit la rotation du nœud (`transform: rotate`) et grandit avec le contenu
  (`scrollHeight`). La frappe met à jour le state en live ;
  comme le nœud est masqué, `useDebouncedExport` accepte un hook `prepare`
  qui le ré-affiche le temps du `toDataURL` (lu via ref, ne redéclenche pas
  l'effet). Échap restaure le texte capturé au double-clic.
- **Texte riche → Konva** : gras/italique = `fontStyle` combiné ("italic
  bold"), souligné = `textDecoration`, `align: justify` **exige une width**
  → figée à la largeur courante quand l'utilisateur clique Justifier. Resize
  d'un texte : le scale devient `fontSize` (arrondi, minimum 6, sans
  plafond — contrairement au champ de la toolbar) et proportionne `width`
  si définie. Fontes web-safe uniquement (pas de course de chargement canvas).
- **Toolbar sans vol de focus** : `onMouseDown={e => e.preventDefault()}`
  sur les boutons de style → le textarea garde le focus, styles en direct.
- **SSR Konva** : konva résout le paquet natif `canvas` côté Node. Unique
  point d'entrée : `dynamic(import LabelEditor, { ssr: false })` dans
  `CandleConfigurator` (en Next 16, `ssr:false` n'est permis QUE depuis un
  composant client). Ne jamais importer react-konva depuis le graphe serveur.
  Pendant le chargement dynamique, un skeleton animé (`animate-pulse`)
  tient la place de l'éditeur.
- **CandleViewer sans rebuild** : l'effet principal construit la scène et
  publie `worldRef` + incrémente `sceneRevision` ; un second effet gère le
  mesh étiquette seul (flag `cancelled` contre les décodages dans le
  désordre, dispose complet geometry/material/map, l'ancien mesh retiré
  seulement quand le nouveau est prêt → pas de clignotement). Renderer
  `alpha: true` (la page fournit le fond) et `preserveDrawingBuffer: true`.
  Cleanup : `renderer.dispose()`
  **puis `renderer.forceContextLoss()`** — sinon les remontages
  (StrictMode/hot-reload) accumulent des contextes WebGL jusqu'au blocage
  navigateur (« context loss and was blocked »).
- **Transparents 3D : ordre imposé par `renderOrder`** (le tri par distance
  de three.js est instable pour des transparents imbriqués) : paroi du
  godet scindée en deux passes (`BackSide` 0, `FrontSide` 2), flamme entre
  les deux (1), étiquette au-dessus (3). Le rebord du godet = deux
  demi-tores réorientés à chaque frame selon l'azimut caméra (un tore ne se
  scinde pas par `side`). Matériau étiquette `transparent: true` (PNG
  alpha) **+ `depthWrite: false`** — sans quoi ses pixels transparents
  masquaient la paroi du godet (glitch « rectangle blanc »).
- **Éclairage & flamme** : HemisphereLight fixe + key/fill directionnels
  attachés à la caméra (les reflets suivent la rotation) ; cire en
  `MeshPhysicalMaterial` (clearcoat 0.4), plastique du godet lisse
  (roughness 0.05, clearcoat 0.6). Flamme = spritesheet animée,
  paramétrable via la prop `flame` (défauts : `/candle/flame-sprites.png`,
  20 frames, 12,5 fps, heightMm 35 ; 0 = éteinte, sans halo) + une
  « respiration » verticale ancrée à la base.

## Pièges connus / dette

- **Grid + canvas** : les items de grille ont `min-width:auto` → un canvas
  dimensionné en px empêche sa colonne de rétrécir (boucle avec le
  ResizeObserver). Toujours `min-w-0` sur les items contenant un canvas.
- **Dev uniquement** : un hot-reload qui recrée les nœuds DOM sans remonter
  les composants laisse les ResizeObservers sur des nœuds détachés → canvas
  mal dimensionné jusqu'au F5. Idem, l'état de l'éditeur peut être perdu par
  Fast Refresh. Pas un bug de prod.
- Le textarea d'édition **approxime** les métriques texte de Konva : légère
  dérive visuelle possible pendant la frappe (accepté PoC).
- Nœud pivoté : accrochage resize « meilleur effort » par axe (l'AABB ne
  suit plus la diagonale du Transformer).
- `useDebouncedExport` étale `...triggers` dans les deps (liste dynamique
  volontaire) ; deux `biome-ignore useExhaustiveDependencies` documentés
  (Transformer / effet étiquette) : `elements` et `sceneRevision` sont des
  déclencheurs, pas des valeurs lues.
- Toolbar : `min-h-12` ne réserve qu'une ligne — sur écran étroit la barre
  contextuelle texte passe à la ligne et décale l'étiquette à la
  sélection/désélection d'un texte.
- Upload d'image : aucune validation (`accept="image/*"` purement
  indicatif, pas de limite de poids) ; un fichier non décodable échoue en
  silence (pas de `onerror` sur le probe) et son objectURL n'est jamais
  révoqué.
- Le bouton « Supprimer » reste visuellement actif pendant l'édition d'un
  texte mais est inopérant (`removeSelected` sort si `editingId` est posé).
- La modale de changement de modèle affirme « pas les mêmes dimensions »
  alors que 3 presets sur 4 partagent la même étiquette 200×70 : le reset
  est en réalité inconditionnel (remount par `key`).
- `app/layout.tsx` : `lang="en"` alors que toute l'UI est en français.
- Boilerplate résiduel : README.md (npm/Vercel, contredit la convention
  bun) et assets morts dans `public/` (5 SVG create-next-app +
  `label-sunset.png` orpheline).

## Vérification

- `bun test` : géométrie d'accrochage (stops, snap, clamp, AABB).
- `bun run build` : compile + prouve la SSR-safety Konva.
- Gomme magique : lancer `cd detourage && .venv/bin/uvicorn server:app
  --port 8001` (cf. `detourage/README.md`), puis upload d'une image →
  l'image revient détourée (~30 s CPU) ; clic sur un morceau dans le
  panneau → il disparaît de l'image ET de la bougie ; re-clic → il revient.
  Sans serveur : l'image d'origine reste, panneau en « injoignable ».
- Manuel via MCP chrome-devtools sur le serveur de dev (port 3000) :
  scénario type = « + Texte » → drag (guides fuchsia, butée aux bords) →
  double-clic (textarea, frappe → bougie à jour en live) → resize par
  poignée (accrochage exact, ex. fontSize 32 → 16 sur le stop mi-hauteur) →
  upload image (injection `DataTransfer` sur l'input file) → la texture de
  la bougie ne montre jamais poignées/guides/fond, et la caméra 3D ne saute
  jamais (marqueur `dataset` sur le canvas three.js pour prouver l'absence
  de rebuild).
