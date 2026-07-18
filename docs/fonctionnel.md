# Votre Bougie — Documentation fonctionnelle

## Vision produit

Configurateur e-commerce de **bougies et veilleuses personnalisées** : le
client choisit un modèle de bougie, compose l'étiquette imprimée (images +
textes) et voit le résultat en direct sur un aperçu 3D qu'il peut faire
tourner. Statut : PoC avancé, pas de persistance ni de backend.

**Pourquoi un éditeur maison et pas Canva** : le Canva Button (éditeur
embarqué avec retour d'image) a été arrêté fin 2025 ; l'alternative Connect
API impose un compte Canva par client + un aller-retour vers canva.com + une
revue d'intégration. Décision (juillet 2026) : éditeur Konva maison.

## Parcours utilisateur

Page unique (`/`). Sélecteur de modèle en tête. En desktop : aperçu 3D à
gauche (~30 %), éditeur à droite. En mobile : aperçu au-dessus, éditeur en
dessous pleine largeur. L'interface suit le thème clair/sombre du système ;
la surface de travail de l'éditeur reste volontairement claire (l'étiquette
blanche « posée » y garde son contraste).

### Modèles de bougie (templates)
- Presets en dur (`templates.ts`) décrivant tout en **millimètres** : cire
  (rayon, hauteur, couleur, arrondi d'arêtes optionnel), godet optionnel
  (hauteur totale, pied, épaisseur, couleur, opacité) et étiquette
  (largeur × hauteur, toujours centrée en hauteur sur son support).
- Quatre presets : **Veilleuse classique** (godet blanc translucide),
  **Veilleuse godet rouge** (godet quasi opaque), **Veilleuse godet vert à
  pied** (fond surélevé de 31 mm) — étiquette 200 × 70 mm pour les trois —
  et **Pilier ambré sans godet** (étiquette 200 × 60 mm, arêtes arrondies).
- Sans godet, l'étiquette s'imprime directement sur la cire.
- Changer de modèle **réinitialise l'étiquette** — reset inconditionnel
  (remount de l'éditeur), même entre modèles aux dimensions d'étiquette
  identiques ; si des éléments seraient perdus, une modale de confirmation
  (Radix AlertDialog) le demande d'abord — annuler ramène le sélecteur à la
  valeur courante.

### Aperçu 3D
- Bougie (cire, godet translucide éventuel avec pied, mèche, flamme animée
  — spritesheet paramétrable, peut être éteinte —, halo vacillant), rotation
  libre à la souris (OrbitControls ; zoom et déplacement restent actifs et
  non bornés à ce stade).
- L'étiquette composée est projetée incurvée sur le support, mise à jour
  **500 ms après la dernière interaction** dans l'éditeur (debounce), sans
  jamais réinitialiser l'angle de vue ni clignoter.
- **L'étiquette est transparente par défaut** : seuls les éléments dessinés
  apparaissent, le support reste visible autour (comme une vraie impression).

### Éditeur d'étiquette
- Surface de travail : rectangle blanc aux proportions physiques de
  l'étiquette du modèle actif, « posé » sur un fond gris très clair avec
  ombre portée. Un texte d'aide rappelle les dimensions en mm.
- Barre d'outils unique au-dessus (hauteur réservée : pas de décalage en
  desktop ; sur écran étroit les options texte peuvent passer à la ligne) :
  actions du document (**+ Image** — upload local, **+ Texte**,
  **Supprimer**), puis options contextuelles du texte à leur suite quand un
  texte est sélectionné. Tout élément ajouté est automatiquement
  sélectionné : une image arrive réduite pour tenir dans 60 % de l'étiquette
  (ratio conservé, jamais agrandie) et centrée ; un texte (« Votre texte »,
  32 px) apparaît près du centre.
- Tout élément est **déplaçable, redimensionnable (ratio conservé, poignées
  de coin) et pivotable** via les poignées de sélection. Suppression aussi
  au clavier (Suppr/Retour arrière, neutralisé pendant une saisie).
- **Guides d'alignement magnétiques** (lignes fuchsia pointillées) pendant
  le drag ET le resize : quarts en largeur et centre de l'étiquette (elle enveloppe la
  bougie : centrer sur une moitié visible a du sens), plus bords et centres
  des autres éléments. Pas de guides sur les bords : le déplacement y est
  **borné** — aucun élément ne peut sortir de l'étiquette, ni en drag, ni en
  resize, ni en rotation.
- **Texte riche** : police (8 fontes web-safe), taille (6–200), couleur
  (color picker), gras / italique / souligné, alignement gauche / centré /
  droite / justifié, multiligne (Entrée = retour à la ligne). Les boutons de
  style ne volent pas le focus : on peut styler en pleine frappe.
- **Édition au double-clic** : textarea superposé au texte, contenu
  entièrement sélectionné à l'ouverture (taper remplace tout), édition en
  place même sur un texte pivoté ; la bougie se met à jour en direct pendant
  la frappe ; clic à l'extérieur valide, Échap restaure le texte d'origine. Justifier fige la largeur du bloc (contrainte
  Konva) ; le texte y revient ensuite à la ligne automatiquement.

### Gomme magique (PoC — serveur local requis)

- À l'upload, l'image est **détourée automatiquement** (fond supprimé,
  bords doux) par le serveur local `detourage/server.py` (port 8001) ; le
  PNG détouré remplace l'original dans l'éditeur et donc sur la bougie.
- Tant qu'une image est **sélectionnée** dans l'éditeur, un panneau
  « Gomme magique » l'affiche en grand sur un damier (transparence
  lisible), sous l'étiquette. Cliquer un morceau visible (socle, ornement…)
  le **retire** du détourage ; re-cliquer un morceau retiré le
  **réintègre**. Aucun nommage des parties : l'utilisateur désigne
  visuellement, et la bougie 3D se met à jour en direct à chaque clic.
- Sans serveur lancé, l'upload garde l'image d'origine et le panneau
  affiche « serveur injoignable » — le reste de l'éditeur fonctionne.

## Backlog identifié

- Undo/redo (le reducer du document est prêt pour un historique).
- Persistance du design (state sérialisable ; les objectURLs des images
  devront être remplacés par un upload).
- Presets de modèles depuis une base de données (le type `CandleTemplate`
  est du JSON pur exprès ; seul `CandleTemplateContext` sera à toucher).
- Ordre des calques (z-order), duplication d'élément.
- Accrochage à la rotation (0/45/90°), guides d'espacement égal.
- Fontes personnalisées (attention aux courses de chargement canvas).
- Parcours commande (prix, panier) autour du configurateur.
- Bornage du zoom/pan de l'aperçu 3D (OrbitControls entièrement libres
  aujourd'hui).
- Validation de l'upload d'image (format/poids — échec silencieux
  aujourd'hui si le fichier n'est pas décodable).
- Industrialisation de la gomme magique : déploiement sur le mini PC
  (tunnel Cloudflare), authentification, file d'attente, réponses plus
  légères que le PNG complet à chaque clic, bouton « garder l'original »
  (sans détourage).
