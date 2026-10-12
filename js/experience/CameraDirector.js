/**
 * CameraDirector.js — Réalisation caméra.
 *
 * Le scroll (progress global 0..1) pilote une trajectoire de caméra
 * définie par keyframes { t, position, cible, fov }. Le réalisateur
 * interpole entre les keyframes avec un lissage, puis la caméra est
 * amortie (damping) pour un mouvement parfaitement fluide.
 *
 * Les keyframes sont reconstruits à partir des positions réelles des
 * sections DOM (build(ranges)), afin que chaque scène 3D reste
 * parfaitement synchronisée avec son contenu HTML.
 */

import * as THREE from 'three';

export class CameraDirector {
  constructor(camera) {
    this.camera = camera;
    this.keyframes = [];
    this.progress = 0;

    // État courant (amorti)
    this.pos = new THREE.Vector3(7.5, 1.3, 7.5);
    this.look = new THREE.Vector3(0, 0.7, 0);
    this.fov = 40;

    // Cibles interpolées depuis les keyframes
    this._targetPos = this.pos.clone();
    this._targetLook = this.look.clone();
    this._targetFov = 40;

    // Recul supplémentaire sur écran portrait (voir setAspect)
    this.distanceScale = 1;
    this._offset = new THREE.Vector3();

    camera.position.copy(this.pos);
    camera.lookAt(this.look);
  }

  /**
   * Construit la trajectoire complète à partir des plages de scroll
   * de chaque section : ranges.hero = [tDebut, tFin], etc.
   */
  build(ranges) {
    const K = [];
    const kf = (t, px, py, pz, lx, ly, lz, fov = 40) =>
      K.push({ t, pos: new THREE.Vector3(px, py, pz), look: new THREE.Vector3(lx, ly, lz), fov });
    // Interpolation locale dans une plage [a, b]
    const at = ([a, b], f) => a + (b - a) * f;

    /* Scène 1 — Hero : lente avancée en 3/4 avant */
    kf(0,                     5.6, 1.15, 5.9,   0, 0.65, 0,   38);
    kf(at(ranges.hero, 0.55), 4.6, 0.95, 5.0,   0.4, 0.6, 0,  40);
    kf(ranges.hero[1],        5.9, 1.5, 2.6,    0, 0.65, 0,   42);

    /* Scène 2 — Design : tour complet du véhicule */
    const d = ranges.design;
    kf(at(d, 0.10), 4.4, 0.85, 4.6,    0.8, 0.55, 0.4, 44);   // peinture
    kf(at(d, 0.28), 2.7, 0.85, 4.9,    1.45, 0.45, 0.8, 46);  // roue avant / freins
    kf(at(d, 0.46), -2.2, 0.8, 5.6,    -0.8, 0.6, 0, 44);     // profil
    kf(at(d, 0.64), -5.6, 0.95, 2.6,   -2.2, 0.75, 0, 42);    // feux arrière
    kf(at(d, 0.82), -5.4, 1.6, -2.6,   0, 0.7, 0, 42);        // 3/4 arrière opposé
    kf(d[1],        -0.6, 1.3, -6.0,   0.6, 0.7, 0, 42);      // profil opposé

    /* Scène 3 — Moteur : plongée vers la vue éclatée */
    const e = ranges.engine;
    kf(at(e, 0.18), 4.6, 2.5, -3.0,    1.35, 1.45, 0, 42);
    kf(at(e, 0.45), 4.9, 2.8, 2.0,     1.35, 1.6, 0, 40);
    kf(at(e, 0.75), 4.3, 2.6, -2.2,    1.35, 1.65, 0, 40);
    kf(e[1],        4.5, 2.3, 2.1,     1.35, 1.55, 0, 40);

    /* Scène 4 — Intérieur : entrée par la vitre conducteur (côté -Z) */
    const i = ranges.interior;
    kf(at(i, 0.22), 2.0, 1.35, -2.1,   0.6, 0.95, -0.3, 44);
    kf(at(i, 0.50), 0.6, 1.15, -1.0,   0.7, 0.9, -0.37, 52);
    kf(at(i, 0.75), -0.12, 1.07, -0.37, 0.75, 0.9, -0.02, 58); // au poste de conduite
    kf(i[1],        -0.22, 1.1, -0.12, 0.7, 0.88, 0.18, 55);

    /* Scène 5 — Performance : ras du sol, tension */
    const p = ranges.perf;
    kf(at(p, 0.20), 3.4, 0.55, 4.2,    0, 0.55, 0, 48);
    kf(at(p, 0.60), 4.3, 0.45, 2.4,    0.6, 0.5, 0, 55);
    kf(p[1],        4.9, 0.6, 1.6,     0.8, 0.55, 0, 58);

    /* Scène 6 — Galerie : prise de hauteur contemplative */
    const g = ranges.gallery;
    kf(at(g, 0.30), 6.6, 4.2, 6.6,     0, 0.4, 0, 44);
    kf(g[1],        8.2, 5.4, 7.8,     0, 0.3, 0, 42);

    /* Scène 7 — Configurateur : plateau studio, lente orbite */
    const c = ranges.config;
    kf(at(c, 0.15), 5.0, 1.45, 3.8,    0, 0.55, 0, 40);
    kf(at(c, 0.55), 2.2, 1.3, 5.5,     0, 0.55, 0, 40);
    kf(c[1],        -1.2, 1.5, 5.7,    0, 0.6, 0, 40);

    /* Scène 8 — Finale : la caméra se pose, la voiture part */
    const f = ranges.finale;
    kf(at(f, 0.18), -5.6, 1.5, 2.6,    0, 0.65, 0, 42);
    kf(at(f, 0.42), -6.4, 1.8, 0.4,    1.5, 0.6, 0, 44);
    kf(1.0,         -6.4, 2.0, 0.4,    9.0, 0.7, 0, 46);      // regard vers l'horizon

    K.sort((a, b) => a.t - b.t);
    this.keyframes = K;
  }

  setProgress(p) { this.progress = p; }

  /**
   * Les trajectoires sont pensées pour un écran paysage : en portrait,
   * la voiture déborderait du cadre, donc la caméra recule.
   */
  setAspect(aspect) {
    if (!(aspect > 0 && isFinite(aspect))) return;   // onglet masqué au chargement
    this.distanceScale = aspect >= 1 ? 1 : THREE.MathUtils.clamp(1 / aspect, 1, 2.6);
  }

  /** Interpolation + amortissement — appelé chaque frame. */
  update(dt) {
    const K = this.keyframes;
    if (K.length >= 2) {
      const p = this.progress;
      let idx = 0;
      while (idx < K.length - 2 && K[idx + 1].t < p) idx++;
      const a = K[idx], b = K[idx + 1];
      const span = Math.max(b.t - a.t, 1e-5);
      let f = THREE.MathUtils.clamp((p - a.t) / span, 0, 1);
      f = f * f * (3 - 2 * f);   // smoothstep : aucune cassure de vitesse

      this._targetPos.lerpVectors(a.pos, b.pos, f);
      this._targetLook.lerpVectors(a.look, b.look, f);
      this._targetFov = a.fov + (b.fov - a.fov) * f;
    }

    // Amortissement exponentiel (indépendant du framerate)
    const damp = 1 - Math.exp(-dt * 5.2);
    this.pos.lerp(this._targetPos, damp);
    this.look.lerp(this._targetLook, damp);
    this.fov += (this._targetFov - this.fov) * damp;

    // Recul portrait, sauf pour les plans rapprochés (habitacle)
    this._offset.subVectors(this.pos, this.look);
    const dist = this._offset.length();
    const far = THREE.MathUtils.smoothstep(dist, 1.5, 3);
    const scale = 1 + (this.distanceScale - 1) * far;
    this.camera.position.copy(this.look).addScaledVector(this._offset, scale);
    this.camera.lookAt(this.look);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  /** Décalage parallaxe souris (appliqué après update). */
  applyMouseParallax(nx, ny, strength = 0.18) {
    this.camera.position.x += nx * strength;
    this.camera.position.y += ny * strength * 0.5;
    this.camera.lookAt(this.look);
  }
}
