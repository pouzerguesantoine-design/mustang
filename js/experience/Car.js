/**
 * Car.js — Ford Mustang Shelby GT500 (modèle 3D haute qualité).
 *
 * Charge le FBX (assets/models) puis :
 *  - ré-applique des matériaux PBR nommés (peinture clearcoat, verre
 *    fumé, cuir, chrome, étriers…) — l'export ne contient pas de couleurs ;
 *  - re-pivote les roues pour la rotation au scroll ;
 *  - repère aileron, feux, échappements, moteur (pour la vue éclatée) ;
 *  - conserve l'API publique de la version procédurale
 *    (setPaint, setLights, setWheelStyle, setSpoiler, update…).
 *
 * Repère final : +X = avant du véhicule, +Y = haut, conducteur côté -Z.
 */

import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const MODEL_URL = 'assets/models/shelby-src/source/maya2sketchfab.fbx';

/** Pièces clonées pour la vue éclatée + direction d'éclatement. */
const ENGINE_PARTS = [
  ['GT500Engine',       [0, 0, 0]],
  ['GT500Supercharger', [0.3, 1.5, 0]],
  ['GT500Transmission', [-1.5, -0.2, 0]],
];

export class Car {
  /**
   * @param {THREE.Scene} scene
   * @param {(p:number)=>void} [onProgress] progression du téléchargement [0..1]
   */
  constructor(scene, onProgress) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'shelby-gt500';

    this.wheels = [];          // pivots de rotation
    this.exhaustTips = [];     // points d'émission de la fumée
    this.engineParts = [];     // clones { mesh, dir } pour la vue éclatée
    this.headlightSpots = [];
    this.headlightGlows = [];
    this.body = null;          // wrapper du modèle (suspension)
    this.spoilerPivot = null;

    this._buildMaterials();
    this._buildLightRig();
    scene.add(this.group);

    this.ready = this._load(onProgress);
  }

  /* ── Matériaux PBR (le FBX n'embarque ni couleurs ni textures) ── */
  _buildMaterials() {
    this.mats = {
      paint: new THREE.MeshPhysicalMaterial({
        color: 0x9e0d18, metalness: 0.85, roughness: 0.28,
        clearcoat: 1.0, clearcoatRoughness: 0.06, envMapIntensity: 1.4,
      }),
      glass: new THREE.MeshPhysicalMaterial({
        color: 0x080b10, metalness: 0.1, roughness: 0.05,
        transparent: true, opacity: 0.8, envMapIntensity: 1.4,
        side: THREE.DoubleSide,
      }),
      glossblack: new THREE.MeshStandardMaterial({
        color: 0x0d0e10, metalness: 0.5, roughness: 0.25, envMapIntensity: 1.1,
      }),
      leather: new THREE.MeshStandardMaterial({
        color: 0x191a1e, metalness: 0.05, roughness: 0.85,
      }),
      seat: new THREE.MeshStandardMaterial({
        color: 0x141519, metalness: 0.05, roughness: 0.9,
      }),
      mirror: new THREE.MeshStandardMaterial({
        color: 0xd8dce2, metalness: 1.0, roughness: 0.04, envMapIntensity: 1.8,
      }),
      plate: new THREE.MeshStandardMaterial({
        color: 0x5c6067, metalness: 1.0, roughness: 0.42,
      }),
      engineMetal: new THREE.MeshStandardMaterial({
        color: 0x5a5e66, metalness: 0.9, roughness: 0.3, envMapIntensity: 1.6,
      }),
      roll: new THREE.MeshStandardMaterial({
        color: 0x222327, metalness: 0.6, roughness: 0.5,
      }),
      orange: new THREE.MeshStandardMaterial({
        color: 0xc96a1a, metalness: 0.3, roughness: 0.4,
        emissive: 0x873f05, emissiveIntensity: 0.25,
      }),
      whiteGloss: new THREE.MeshStandardMaterial({
        color: 0xe8e5de, metalness: 0.4, roughness: 0.3,
      }),
      tire: new THREE.MeshStandardMaterial({
        color: 0x0b0b0c, metalness: 0.0, roughness: 0.94,
      }),
      rim: new THREE.MeshStandardMaterial({
        color: 0xc9cdd4, metalness: 1.0, roughness: 0.22, envMapIntensity: 1.4,
      }),
      caliper: new THREE.MeshStandardMaterial({
        color: 0xc41320, metalness: 0.4, roughness: 0.35,
      }),
      headlight: new THREE.MeshStandardMaterial({
        color: 0xf8fbff, emissive: 0xcfe6ff, emissiveIntensity: 0,
      }),
      taillight: new THREE.MeshStandardMaterial({
        color: 0x30060a, emissive: 0xff1626, emissiveIntensity: 0,
      }),
      screen: new THREE.MeshStandardMaterial({
        color: 0x04070c, emissive: 0x17497f, emissiveIntensity: 0.55,
      }),
    };

    // Correspondance nom de matériau FBX → matériau PBR
    this.matMap = {
      carpaint: this.mats.paint,
      tinted_glass: this.mats.glass,
      glossblack: this.mats.glossblack,
      leather: this.mats.leather,
      seat: this.mats.seat,
      mirror: this.mats.mirror,
      plate: this.mats.plate,
      roll: this.mats.roll,
      orange: this.mats.orange,
      white_gloss: this.mats.whiteGloss,
      tire: this.mats.tire,
      lambert1: this.mats.rim,        // jantes
      brake: this.mats.caliper,       // étriers + disques
      light: this.mats.headlight,
      rearlight: this.mats.taillight,
    };
  }

  /* ── Éléments indépendants du modèle : projecteurs, halos, ombre ── */
  _buildLightRig() {
    const glowTex = Car._makeGlowTexture();

    for (const side of [1, -1]) {
      // Projecteur réel (éclaire le sol et le brouillard)
      const spot = new THREE.SpotLight(0xdcecff, 0, 30, 0.34, 0.6, 1.2);
      spot.position.set(2.1, 0.75, side * 0.66);
      const target = new THREE.Object3D();
      target.position.set(12, 0.1, side * 1.1);
      this.group.add(target);
      spot.target = target;
      this.group.add(spot);
      this.headlightSpots.push(spot);

      // Halo additif
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: 0xbfe0ff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      glow.scale.setScalar(0.34);
      glow.position.set(2.25, 0.78, side * 0.66);
      this.group.add(glow);
      this.headlightGlows.push(glow);
    }

    // Ombre de contact : ancre la voiture au sol
    const contact = new THREE.Mesh(
      new THREE.PlaneGeometry(5.8, 2.7),
      new THREE.MeshBasicMaterial({
        map: Car._makeContactShadowTexture(),
        transparent: true, opacity: 0.85, depthWrite: false,
      })
    );
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = 0.005;
    contact.renderOrder = 1;
    this.group.add(contact);
  }

  /* ── Chargement + préparation du FBX ────────────────────── */
  async _load(onProgress) {
    try {
      const root = await new FBXLoader().loadAsync(MODEL_URL, (e) => {
        if (e.total) onProgress?.(e.loaded / e.total);
      });
      this._setup(root);
      onProgress?.(1);
    } catch (err) {
      console.error('[Mustang] Échec du chargement du modèle :', err);
    }
  }

  _setup(root) {
    /* Échelle cm → m, avant du véhicule vers +X */
    root.scale.setScalar(0.01);
    root.rotation.y = Math.PI / 2;
    root.updateMatrixWorld(true);

    /* Recentrage : milieu en X/Z, roues posées sur le sol */
    const box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    const wrapper = new THREE.Group();
    wrapper.name = 'model-wrapper';
    wrapper.add(root);
    root.position.set(-center.x, -box.min.y, -center.z);

    /* Matériaux PBR */
    root.traverse((o) => {
      if (!o.isMesh) return;
      const remap = (m) => this.matMap[m.name] || this.mats.glossblack;
      o.material = Array.isArray(o.material) ? o.material.map(remap) : remap(o.material);
    });

    /* Écrans intérieurs : compteurs + écran central lumineux */
    for (const name of ['GT500Gauges', 'GT500Screen']) {
      const m = root.getObjectByName(name);
      if (m) m.material = this.mats.screen;
    }

    this.body = wrapper;
    this.group.add(wrapper);
    this.group.updateMatrixWorld(true);

    /* Roues : re-parentées sur des pivots centrés (rotation au scroll) */
    for (const name of ['GT500WheelFtL', 'GT500WheelFtR', 'GT500WheelBkL', 'GT500WheelBkR']) {
      const mesh = root.getObjectByName(name);
      if (!mesh) continue;
      const pivot = new THREE.Group();
      pivot.position.copy(new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3()));
      this.group.add(pivot);
      pivot.attach(mesh);
      this._consolidatePivotChild(pivot, mesh);
      this.wheels.push(pivot);
    }

    /* Aileron : pivot dédié pour l'option du configurateur */
    const wing = root.getObjectByName('GT500Wing');
    if (wing) {
      const pivot = new THREE.Group();
      pivot.position.copy(new THREE.Box3().setFromObject(wing).getCenter(new THREE.Vector3()));
      this.group.add(pivot);
      pivot.attach(wing);
      this._consolidatePivotChild(pivot, wing);
      this.spoilerPivot = pivot;
    }

    /* Positions réelles des optiques → halos & projecteurs */
    ['GT500HeadlightL', 'GT500HeadlightR'].forEach((name, i) => {
      const m = root.getObjectByName(name);
      if (!m) return;
      const p = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3());
      this.headlightGlows[i]?.position.set(p.x + 0.1, p.y, p.z);
      this.headlightSpots[i]?.position.set(p.x - 0.1, p.y, p.z);
    });

    /* Sorties d'échappement → émetteurs de fumée */
    for (const name of ['GT500ExhaustTipL', 'GT500ExhaustTipR']) {
      const m = root.getObjectByName(name);
      if (!m) continue;
      const tip = new THREE.Object3D();
      tip.position.copy(new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()));
      tip.position.x -= 0.15;
      this.group.add(tip);
      this.exhaustTips.push(tip);
    }

    /* Clones du moteur pour la vue éclatée (scène 3) —
       avant la fusion, car elle retire les meshes d'origine */
    this._prepareEngineParts(root);

    /* Fusion de la géométrie statique : l'export FBX fragmente les
       meshes en ~1600 draw calls ; on fusionne tout en un mesh par
       matériau (~15 draw calls) pour tenir 60 FPS. */
    this._mergeStaticGeometry(root, wrapper);
  }

  /**
   * Fusionne tous les meshes restants de `root` (roues et aileron ont
   * déjà été déplacés sur leurs pivots) en un seul mesh par matériau,
   * transformations mondiales incluses, re-parentés sous `wrapper`
   * pour conserver l'animation de suspension.
   */
  _mergeStaticGeometry(root, wrapper) {
    root.updateMatrixWorld(true);

    const buckets = new Map();   // matériau → sous-géométries
    const doomed = [];

    root.traverse((o) => {
      if (!o.isMesh) return;
      doomed.push(o);
      Car._splitMeshIntoBuckets(o, o.matrixWorld, buckets);
    });

    for (const m of doomed) m.removeFromParent();

    // Matériaux qui ne projettent pas d'ombre (verre, optiques, écrans)
    const NO_SHADOW = new Set([
      this.mats.glass, this.mats.headlight, this.mats.taillight, this.mats.screen,
    ]);

    for (const [mat, geos] of buckets) {
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = !NO_SHADOW.has(mat);
      // Verre rendu en dernier (transparence correcte sur l'habitacle)
      if (mat === this.mats.glass) mesh.renderOrder = 2;
      wrapper.add(mesh);
    }
  }

  /**
   * Découpe un mesh multi-matériaux en sous-géométries par matériau
   * (transformées par `matrix`), accumulées dans `buckets`.
   */
  static _splitMeshIntoBuckets(mesh, matrix, buckets) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const geo = mesh.geometry;
    const indexCount = geo.index ? geo.index.count : geo.attributes.position.count;
    const groups = geo.groups?.length
      ? geo.groups
      : [{ start: 0, count: indexCount, materialIndex: 0 }];

    for (const g of groups) {
      const mat = mats[g.materialIndex] ?? mats[0];
      const count = Math.min(g.count, indexCount - g.start);
      if (count <= 0) continue;

      // Sous-géométrie du groupe : index borné + attributs partagés
      let sub = new THREE.BufferGeometry();
      sub.setAttribute('position', geo.attributes.position);
      if (geo.attributes.normal) sub.setAttribute('normal', geo.attributes.normal);
      if (geo.index) {
        sub.setIndex(new THREE.BufferAttribute(geo.index.array.slice(g.start, g.start + count), 1));
      } else {
        const idx = new Uint32Array(count);
        for (let i = 0; i < count; i++) idx[i] = g.start + i;
        sub.setIndex(new THREE.BufferAttribute(idx, 1));
      }
      sub = sub.toNonIndexed();       // taille = triangles réels du groupe
      sub.applyMatrix4(matrix);       // transformation figée

      if (!buckets.has(mat)) buckets.set(mat, []);
      buckets.get(mat).push(sub);
    }
  }

  /**
   * Remplace un enfant de pivot (roue, aileron) par des meshes
   * fusionnés par matériau — mêmes gains de draw calls que la caisse.
   */
  _consolidatePivotChild(pivot, mesh) {
    mesh.updateMatrix();
    const buckets = new Map();
    Car._splitMeshIntoBuckets(mesh, mesh.matrix, buckets);
    mesh.removeFromParent();
    for (const [mat, geos] of buckets) {
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!merged) continue;
      const m = new THREE.Mesh(merged, mat);
      m.castShadow = true;
      pivot.add(m);
    }
  }

  /**
   * Clone moteur, compresseur, radiateur… en conservant leurs
   * transformations mondiales, recentrés autour du bloc moteur.
   */
  _prepareEngineParts(root) {
    const clones = [];
    let engineCenter = null;

    for (const [name, dir] of ENGINE_PARTS) {
      const src = root.getObjectByName(name);
      if (!src) continue;
      src.updateWorldMatrix(true, false);

      // Copie fusionnée par matériau (l'original est très fragmenté)
      const holder = new THREE.Group();
      holder.name = name + '-exploded';
      src.matrixWorld.decompose(holder.position, holder.quaternion, holder.scale);
      const buckets = new Map();
      Car._splitMeshIntoBuckets(src, new THREE.Matrix4(), buckets);
      for (const [mat, geos] of buckets) {
        const merged = mergeGeometries(geos, false);
        geos.forEach((g) => g.dispose());
        // L'export peint les pièces en « carpaint » ou « glossblack » :
        // en vue éclatée elles sont rendues en métal usiné, lisible sur fond noir
        const engineMat = (mat === this.mats.paint || mat === this.mats.glossblack)
          ? this.mats.engineMetal : mat;
        if (merged) holder.add(new THREE.Mesh(merged, engineMat));
      }

      if (name === 'GT500Engine') {
        engineCenter = new THREE.Box3().setFromObject(src).getCenter(new THREE.Vector3());
      }
      clones.push({ mesh: holder, dir: new THREE.Vector3(...dir) });
    }
    if (!engineCenter) return;

    for (const c of clones) c.mesh.position.sub(engineCenter);
    this.engineParts = clones;
  }

  /* ── API publique (identique à la version procédurale) ──── */

  /** Intensité des feux [0..1]. */
  setLights(v) {
    this.mats.headlight.emissiveIntensity = v * 3.4;
    this.mats.taillight.emissiveIntensity = v * 1.6;
    for (const s of this.headlightSpots) s.intensity = v * 130;
    for (const g of this.headlightGlows) g.material.opacity = v * 0.5;
  }

  /** Teinte carrosserie (hex string). */
  setPaint(hex) {
    const c = new THREE.Color(hex);
    gsap.to(this.mats.paint.color, { r: c.r, g: c.g, b: c.b, duration: 0.8, ease: 'power2.out' });
  }

  /** Couleur des étriers. */
  setCalipers(hex) {
    const c = new THREE.Color(hex);
    gsap.to(this.mats.caliper.color, { r: c.r, g: c.g, b: c.b, duration: 0.6 });
  }

  /** Finition des jantes : 'sport' (argent poli) | 'track' (noir satin). */
  setWheelStyle(style) {
    const target = style === 'sport'
      ? { color: new THREE.Color(0xc9cdd4), roughness: 0.22 }
      : { color: new THREE.Color(0x1a1b1e), roughness: 0.42 };
    gsap.to(this.mats.rim.color, {
      r: target.color.r, g: target.color.g, b: target.color.b, duration: 0.6,
    });
    gsap.to(this.mats.rim, { roughness: target.roughness, duration: 0.6 });
  }

  /** Affiche / masque l'aileron. */
  setSpoiler(on) {
    if (!this.spoilerPivot) return;
    const s = on ? 1 : 0.001;
    gsap.to(this.spoilerPivot.scale, { x: s, y: s, z: s, duration: 0.5, ease: 'power3.out' });
  }

  /** Couleur d'ambiance intérieure (écrans + lumière d'habitacle). */
  setAmbient(hex) {
    const c = new THREE.Color(hex);
    gsap.to(this.mats.screen.emissive, { r: c.r * 0.5, g: c.g * 0.5, b: c.b * 0.5, duration: 0.6 });
    if (this.interiorLight) {
      gsap.to(this.interiorLight.color, { r: c.r, g: c.g, b: c.b, duration: 0.6 });
    }
  }

  /** Opacité du vitrage (fondu quand la caméra entre dans l'habitacle). */
  setGlassOpacity(v) {
    this.mats.glass.opacity = v;
  }

  /**
   * Mise à jour par frame.
   * @param {number} dt         delta time (s)
   * @param {number} elapsed    temps total (s)
   * @param {number} wheelSpeed rotation des roues (rad/s)
   * @param {number} vibration  vibration carrosserie [0..1]
   */
  update(dt, elapsed, wheelSpeed, vibration) {
    for (const w of this.wheels) w.rotation.z -= wheelSpeed * dt;

    if (this.body) {
      const idle = Math.sin(elapsed * 9) * 0.0016 + Math.sin(elapsed * 23) * 0.0009;
      const shake = vibration * (Math.sin(elapsed * 60) * 0.004 + Math.sin(elapsed * 47) * 0.003);
      this.body.position.y = idle + shake;
      this.body.rotation.x = Math.sin(elapsed * 13) * 0.0012 * (1 + vibration * 4);
    }
  }

  /** Lumière d'habitacle (créée par Experience, ambiance configurable). */
  attachInteriorLight() {
    this.interiorLight = new THREE.PointLight(0xe01e2b, 0.45, 2.4, 2);
    this.interiorLight.position.set(0.1, 1.05, 0);
    this.group.add(this.interiorLight);
    // Un soupçon de lumière neutre pour lire les matières de l'habitacle
    const fill = new THREE.PointLight(0xf5f2ea, 0.9, 2.2, 2);
    fill.position.set(0.2, 1.2, 0);
    this.group.add(fill);
  }

  /* ── Textures générées (aucun asset externe) ────────────── */

  static _makeContactShadowTexture() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.translate(128, 64);
    ctx.scale(1, 0.5);
    const g = ctx.createRadialGradient(0, 0, 8, 0, 0, 122);
    g.addColorStop(0, 'rgba(0,0,0,0.95)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-128, -128, 256, 256);
    return new THREE.CanvasTexture(c);
  }

  static _makeGlowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(200,225,255,0.6)');
    grad.addColorStop(1, 'rgba(150,190,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
}
