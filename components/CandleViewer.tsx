"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/** Échelle de la scène : 1 unité three.js = 50 mm. */
const MM = 1 / 50;

/**
 * Profil (demi-coupe, pour LatheGeometry) d'un cylindre aux arêtes
 * arrondies : fond plat, quart de cercle, flanc, quart de cercle, dessus
 * plat. Les raccords sont tangents, le lissage des normales est donc juste.
 */
function roundedCylinderProfile(
  r: number,
  h: number,
  edge: number,
): THREE.Vector2[] {
  const points: THREE.Vector2[] = [new THREE.Vector2(0, -h / 2)];
  const arc = (cy: number, from: number, to: number) => {
    const STEPS = 10;
    for (let i = 0; i <= STEPS; i++) {
      const a = from + ((to - from) * i) / STEPS;
      points.push(
        new THREE.Vector2(
          r - edge + edge * Math.cos(a),
          cy + edge * Math.sin(a),
        ),
      );
    }
  };
  arc(-h / 2 + edge, -Math.PI / 2, 0); // arête basse
  arc(h / 2 - edge, 0, Math.PI / 2); // arête haute
  points.push(new THREE.Vector2(0, h / 2));
  return points;
}

export type CandleViewerProps = {
  /** Rayon de la bougie (cire) en mm. */
  radiusMm: number;
  /** Hauteur de la bougie (cire) en mm. */
  heightMm: number;
  /** Couleur de la cire, hex CSS. */
  waxColor: string;
  /** Rayon d'arrondi des arêtes de la cire, en mm (défaut : 0, arêtes vives). */
  waxEdgeRadiusMm?: number;
  /** Godet plastique ; absent = impression directement sur la cire. */
  cup?: {
    /** Hauteur totale depuis le sol, pied compris, en mm. */
    heightMm: number;
    /** Hauteur du pied (fond surélevé d'autant), en mm. 0 = posé au sol. */
    footMm: number;
    /** Épaisseur du plastique, en mm. */
    thicknessMm: number;
    /** Couleur du plastique, hex CSS. */
    color: string;
    /** Opacité du plastique : 0 invisible → 1 opaque. */
    opacity: number;
  };
  /** Image imprimée sur le godet (ou sur la cire s'il n'y a pas de godet). */
  label?: {
    /** URL de l'image (le ratio est préservé sur la surface). */
    imageUrl: string;
    /** Hauteur imprimée en mm ; toujours centrée en hauteur sur le support. */
    heightMm: number;
  };
  /** Flamme animée (spritesheet horizontale). */
  flame?: {
    /** URL de la spritesheet (défaut : /candle/flame-sprites.png). */
    spriteUrl?: string;
    /** Nombre de frames de la spritesheet (défaut : 20). */
    frames?: number;
    /** Cadence de lecture (défaut : 12,5, la cadence du GIF d'origine). */
    fps?: number;
    /** Hauteur de la flamme en mm (défaut : 35). Mettre 0 pour éteindre. */
    heightMm?: number;
  };
  className?: string;
};

/** Poignées sur la scène construite, pour les mises à jour ciblées (étiquette). */
type CandleWorld = {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  /** Rayon du support de l'étiquette (godet, ou cire sans godet). */
  labelR: number;
  /** Centre vertical du support, où l'étiquette est centrée. */
  labelY: number;
};

export default function CandleViewer({
  radiusMm,
  heightMm,
  waxColor,
  waxEdgeRadiusMm = 0,
  cup,
  label,
  flame,
  className,
}: CandleViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<CandleWorld | null>(null);
  const labelMeshRef = useRef<THREE.Mesh<
    THREE.CylinderGeometry,
    THREE.MeshStandardMaterial
  > | null>(null);
  // Incrémenté à chaque (re)construction de la scène : l'effet étiquette
  // doit repasser après un rebuild, que l'URL ait changé ou non.
  const [sceneRevision, setSceneRevision] = useState(0);

  const labelImageUrl = label?.imageUrl;
  const labelHeightMm = label?.heightMm ?? 0;
  // Le godet est éclaté en scalaires : l'effet scène dépend de valeurs
  // stables, pas de l'identité de l'objet `cup`.
  const hasCup = cup !== undefined;
  const cupHeightMm = cup?.heightMm ?? 0;
  const cupFootMm = cup?.footMm ?? 0;
  const cupThicknessMm = cup?.thicknessMm ?? 0;
  const cupColor = cup?.color ?? "#ffffff";
  const cupOpacity = cup?.opacity ?? 0;
  const flameSpriteUrl = flame?.spriteUrl ?? "/candle/flame-sprites.png";
  const flameFrames = flame?.frames ?? 20;
  const flameFps = flame?.fps ?? 12.5;
  const flameHeightMm = flame?.heightMm ?? 35;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- Dimensions en unités scène ---
    // La cire reste centrée à l'origine ; le godet (s'il existe) est
    // construit autour d'elle. Sa paroi descend jusqu'au sol : le pied est
    // le vide entre le sol et le fond surélevé. Sans godet, T = 0 et
    // l'étiquette se pose directement sur la cire.
    const R = radiusMm * MM;
    const H = heightMm * MM;
    const T = hasCup ? cupThicknessMm * MM : 0;
    const CUP_R = R + T;
    const CUP_H = cupHeightMm * MM;
    const cupBotY = -H / 2 - T; // fond du godet, la cire repose dessus
    const groundY = cupBotY - cupFootMm * MM;
    const cupTopY = groundY + CUP_H;
    const FLAME_H = flameHeightMm * MM;
    const FLAME_BASE_Y = H / 2 - 0.11 * FLAME_H; // la base mord un peu la cire

    const scene = new THREE.Scene();
    scene.background = null; // fond transparent : la page décide

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0.76 * H, 2.6 * (H / 2) + 3.3);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // --- Éclairage : ambiance fixe + kit principal attaché à la caméra ---
    scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d8d8, 1.4));
    scene.add(camera);
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(1.8, 1.2, 0.5);
    key.target.position.set(0, 0, -5);
    camera.add(key, key.target);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-2, 0.5, 0.5);
    fill.target.position.set(0, 0, -5);
    camera.add(fill, fill.target);

    // --- La cire ---
    // Arrondi borné : jamais plus que le rayon ni la demi-hauteur.
    const EDGE_R = Math.min(waxEdgeRadiusMm * MM, R, H / 2);
    const wax = new THREE.Mesh(
      EDGE_R > 0
        ? new THREE.LatheGeometry(roundedCylinderProfile(R, H, EDGE_R), 96)
        : new THREE.CylinderGeometry(R, R, H, 96),
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(waxColor),
        roughness: 0.55,
        clearcoat: 0.4,
        clearcoatRoughness: 0.4,
      }),
    );
    scene.add(wax);

    // --- Le godet translucide collé à la cire (optionnel) ---
    if (hasCup) {
      const plastic = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(cupColor),
        roughness: 0.35,
        clearcoat: 0.6,
        clearcoatRoughness: 0.3,
        transparent: true,
        opacity: cupOpacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const cupWall = new THREE.Mesh(
        new THREE.CylinderGeometry(CUP_R, CUP_R, CUP_H, 96, 1, true),
        plastic,
      );
      cupWall.position.y = groundY + CUP_H / 2;
      const cupBottom = new THREE.Mesh(
        new THREE.CircleGeometry(CUP_R, 96),
        plastic,
      );
      cupBottom.rotation.x = -Math.PI / 2;
      cupBottom.position.y = cupBotY;
      const cupLip = new THREE.Mesh(
        new THREE.TorusGeometry(CUP_R, 0.016, 12, 96),
        plastic,
      );
      cupLip.rotation.x = Math.PI / 2;
      cupLip.position.y = cupTopY;
      scene.add(cupWall, cupBottom, cupLip);
    }

    // --- La mèche : tube brun courbé, bout incandescent ---
    const wickCurve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(0, H / 2 - 0.03, 0),
      new THREE.Vector3(0, H / 2 + 0.08, 0),
      new THREE.Vector3(-0.01, H / 2 + 0.13, 0),
      new THREE.Vector3(-0.045, H / 2 + 0.13, 0),
    );
    const wick = new THREE.Mesh(
      new THREE.TubeGeometry(wickCurve, 24, 0.013, 8),
      new THREE.MeshStandardMaterial({ color: 0x2e1a0c, roughness: 0.9 }),
    );
    const wickTip = new THREE.Mesh(
      new THREE.SphereGeometry(0.013, 12, 12),
      new THREE.MeshStandardMaterial({
        color: 0x2e1a0c,
        roughness: 0.9,
        emissive: 0xff5500,
        emissiveIntensity: 0.6,
      }),
    );
    wickTip.position.copy(wickCurve.getPoint(1));
    scene.add(wick, wickTip);

    // --- Halo chaud vacillant de la flamme ---
    const glow = new THREE.PointLight(0xffa540, 2.0, 6, 1.5);
    glow.position.set(0, H / 2 + 0.35, 0);
    if (FLAME_H > 0) scene.add(glow);

    const loader = new THREE.TextureLoader();
    const disposables: { dispose(): void }[] = [];

    // --- La flamme animée ---
    let flameSprite: THREE.Sprite | null = null;
    if (FLAME_H > 0) {
      loader.load(flameSpriteUrl, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.repeat.x = 1 / flameFrames;
        const aspect = tex.image.width / flameFrames / tex.image.height;
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: tex,
            transparent: true,
            depthWrite: false,
          }),
        );
        sprite.scale.set(FLAME_H * aspect, FLAME_H, 1);
        sprite.position.y = FLAME_BASE_Y + FLAME_H / 2;
        scene.add(sprite);
        flameSprite = sprite;
        disposables.push(tex, sprite.material);
      });
    }

    // --- Boucle de rendu ---
    const t0 = performance.now();
    renderer.setAnimationLoop(() => {
      const t = (performance.now() - t0) / 1000;
      if (flameSprite?.material.map) {
        const frame = Math.floor(t * flameFps) % flameFrames;
        flameSprite.material.map.offset.x = frame / flameFrames;
        // respiration verticale ancrée à la base ; la danse vient du GIF
        const breath =
          1 + 0.025 * Math.sin(t * 3.1) + 0.015 * Math.sin(t * 7.7);
        flameSprite.scale.y = FLAME_H * breath;
        flameSprite.position.y = FLAME_BASE_Y + (FLAME_H * breath) / 2;
      }
      glow.intensity =
        1.9 + 0.35 * Math.sin(t * 9.2) + 0.2 * Math.sin(t * 23.7);
      controls.update();
      renderer.render(scene, camera);
    });

    // --- Adaptation à la taille du conteneur ---
    const resize = () => {
      const { clientWidth: w, clientHeight: h } = container;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    worldRef.current = {
      scene,
      renderer,
      labelR: CUP_R,
      // Centrée sur le godet s'il existe, sinon sur la cire.
      labelY: hasCup ? groundY + CUP_H / 2 : 0,
    };
    setSceneRevision((r) => r + 1);

    return () => {
      worldRef.current = null;
      labelMeshRef.current = null;
      observer.disconnect();
      renderer.setAnimationLoop(null);
      controls.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Sprite) {
          obj.geometry?.dispose();
          const mats = Array.isArray(obj.material)
            ? obj.material
            : [obj.material];
          for (const m of mats) {
            if ("map" in m && m.map instanceof THREE.Texture) m.map.dispose();
            m.dispose();
          }
        }
      });
      for (const d of disposables) d.dispose();
      renderer.dispose();
      // Libère le contexte WebGL immédiatement : sans ça, les remontages
      // (StrictMode, hot-reload) accumulent des contextes jusqu'à ce que
      // le navigateur bloque toute nouvelle création.
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [
    radiusMm,
    heightMm,
    waxColor,
    waxEdgeRadiusMm,
    hasCup,
    cupHeightMm,
    cupFootMm,
    cupThicknessMm,
    cupColor,
    cupOpacity,
    flameSpriteUrl,
    flameFrames,
    flameFps,
    flameHeightMm,
  ]);

  // --- L'étiquette imprimée sur le godet : mise à jour ciblée, sans
  // reconstruire la scène ni réinitialiser la caméra ---
  // biome-ignore lint/correctness/useExhaustiveDependencies: sceneRevision force le repassage après chaque (re)construction de la scène
  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;

    const removeCurrent = () => {
      const old = labelMeshRef.current;
      if (!old) return;
      world.scene.remove(old);
      old.geometry.dispose();
      old.material.map?.dispose();
      old.material.dispose();
      labelMeshRef.current = null;
    };

    if (!labelImageUrl) {
      removeCurrent();
      return;
    }

    let cancelled = false;
    new THREE.TextureLoader().load(labelImageUrl, (tex) => {
      // Un chargement dépassé par un plus récent (ou un démontage) est jeté.
      if (cancelled || worldRef.current !== world) {
        tex.dispose();
        return;
      }
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = world.renderer.capabilities.getMaxAnisotropy();
      const LABEL_H = labelHeightMm * MM;
      const rLabel = world.labelR + 0.004;
      const aspect = tex.image.width / tex.image.height;
      const thetaLength = Math.min((aspect * LABEL_H) / rLabel, Math.PI * 2);
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(
          rLabel,
          rLabel,
          LABEL_H,
          128,
          1,
          true,
          -thetaLength / 2,
          thetaLength,
        ),
        // L'étiquette imprimée est transparente : seuls les éléments
        // dessinés apparaissent, le godet reste visible derrière.
        // depthWrite désactivé : sinon ses pixels (même invisibles)
        // masquent la paroi du godet dans les frames où le tri des
        // transparents la dessine en premier — rectangle blanc à l'écran.
        new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.6,
          transparent: true,
          depthWrite: false,
        }),
      );
      // Toujours après le godet : le tri par distance est instable entre
      // deux cylindres quasi concentriques.
      mesh.renderOrder = 1;
      mesh.position.y = world.labelY;
      // L'ancienne étiquette reste affichée jusqu'à ce que la nouvelle soit
      // prête : pas de clignotement pendant les mises à jour rapprochées.
      removeCurrent();
      world.scene.add(mesh);
      labelMeshRef.current = mesh;
    });

    return () => {
      cancelled = true;
    };
  }, [labelImageUrl, labelHeightMm, sceneRevision]);

  return <div ref={containerRef} className={className} />;
}
