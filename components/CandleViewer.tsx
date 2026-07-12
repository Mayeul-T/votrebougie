"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/** Échelle de la scène : 1 unité three.js = 5 cm. */
const CM = 1 / 5;

export type CandleViewerProps = {
  /** Rayon de la bougie en cm (défaut : 5). */
  radiusCm?: number;
  /** Hauteur de la bougie en cm (défaut : 12,5). */
  heightCm?: number;
  /** Épaisseur du godet plastique en mm, collé à la cire (défaut : 1). */
  cupThicknessMm?: number;
  /** Dépassement du rebord du godet au-dessus de la cire, en cm (défaut : 0,9). */
  cupLipCm?: number;
  /** Image imprimée sur le godet. */
  label?: {
    /** URL de l'image (le ratio est préservé sur la surface). */
    imageUrl: string;
    /** Hauteur imprimée en cm (défaut : 7). */
    heightCm?: number;
    /** Décalage vertical du centre de l'étiquette en cm (défaut : -0,75). */
    offsetYCm?: number;
  };
  /** Flamme animée (spritesheet horizontale). */
  flame?: {
    /** URL de la spritesheet (défaut : /candle/flame-sprites.png). */
    spriteUrl?: string;
    /** Nombre de frames de la spritesheet (défaut : 20). */
    frames?: number;
    /** Cadence de lecture (défaut : 12,5, la cadence du GIF d'origine). */
    fps?: number;
    /** Hauteur de la flamme en cm (défaut : 3,5). Mettre 0 pour éteindre. */
    heightCm?: number;
  };
  className?: string;
};

export default function CandleViewer({
  radiusCm = 5,
  heightCm = 12.5,
  cupThicknessMm = 1,
  cupLipCm = 0.9,
  label,
  flame,
  className,
}: CandleViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const labelImageUrl = label?.imageUrl;
  const labelHeightCm = label?.heightCm ?? 7;
  const labelOffsetYCm = label?.offsetYCm ?? -0.75;
  const flameSpriteUrl = flame?.spriteUrl ?? "/candle/flame-sprites.png";
  const flameFrames = flame?.frames ?? 20;
  const flameFps = flame?.fps ?? 12.5;
  const flameHeightCm = flame?.heightCm ?? 3.5;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- Dimensions en unités scène ---
    const R = radiusCm * CM;
    const H = heightCm * CM;
    const CUP_R = R + (cupThicknessMm / 10) * CM;
    const CUP_LIP = cupLipCm * CM;
    const CUP_H = H + CUP_LIP + (cupThicknessMm / 10) * CM;
    const LABEL_H = labelHeightCm * CM;
    const LABEL_Y = labelOffsetYCm * CM;
    const FLAME_H = flameHeightCm * CM;
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
    const wax = new THREE.Mesh(
      new THREE.CylinderGeometry(R, R, H, 96),
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.55,
        clearcoat: 0.4,
        clearcoatRoughness: 0.4,
      }),
    );
    scene.add(wax);

    // --- Le godet translucide collé à la cire ---
    const plastic = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.35,
      clearcoat: 0.6,
      clearcoatRoughness: 0.3,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const cupBotY = -H / 2 - (cupThicknessMm / 10) * CM;
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(CUP_R, CUP_R, CUP_H, 96, 1, true),
      plastic,
    );
    cup.position.y = cupBotY + CUP_H / 2;
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
    cupLip.position.y = H / 2 + CUP_LIP;
    scene.add(cup, cupBottom, cupLip);

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

    // --- L'étiquette imprimée sur le godet ---
    if (labelImageUrl) {
      loader.load(labelImageUrl, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        const rLabel = CUP_R + 0.004;
        const aspect = tex.image.width / tex.image.height;
        const thetaLength = Math.min((aspect * LABEL_H) / rLabel, Math.PI * 2);
        const labelMesh = new THREE.Mesh(
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
          new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }),
        );
        labelMesh.position.y = LABEL_Y;
        scene.add(labelMesh);
        disposables.push(tex, labelMesh.geometry, labelMesh.material);
      });
    }

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

    return () => {
      observer.disconnect();
      renderer.setAnimationLoop(null);
      controls.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Sprite) {
          obj.geometry?.dispose();
          const mats = Array.isArray(obj.material)
            ? obj.material
            : [obj.material];
          for (const m of mats) m.dispose();
        }
      });
      for (const d of disposables) d.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [
    radiusCm,
    heightCm,
    cupThicknessMm,
    cupLipCm,
    labelImageUrl,
    labelHeightCm,
    labelOffsetYCm,
    flameSpriteUrl,
    flameFrames,
    flameFps,
    flameHeightCm,
  ]);

  return <div ref={containerRef} className={className} />;
}
