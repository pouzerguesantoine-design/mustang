/**
 * Engine.js — V8 5.0 « Coyote » en vue éclatée.
 *
 * Le moteur flotte au-dessus du capot pendant la scène 3.
 * Chaque pièce mémorise une direction d'éclatement ; le scroll
 * pilote la séparation des éléments (setExplode).
 */

import * as THREE from 'three';

export class Engine {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'engine-v8';
    this.group.position.set(1.35, 1.75, 0);
    this.group.scale.setScalar(0.001);   // caché au départ (agrandi par GSAP)
    this.group.visible = false;

    this.parts = [];   // { mesh, basePos, dir }
    this.visibility = 0;

    this._buildMaterials();
    this._build();

    scene.add(this.group);
  }

  _buildMaterials() {
    this.mats = {
      block: new THREE.MeshStandardMaterial({ color: 0x3a3d43, metalness: 0.9, roughness: 0.45 }),
      cover: new THREE.MeshStandardMaterial({ color: 0x8e1016, metalness: 0.55, roughness: 0.4 }),
      alu: new THREE.MeshStandardMaterial({ color: 0x9ba0a8, metalness: 1.0, roughness: 0.3 }),
      chrome: new THREE.MeshStandardMaterial({ color: 0xd8dce2, metalness: 1.0, roughness: 0.15 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x17181c, metalness: 0.6, roughness: 0.5 }),
    };
  }

  /** Enregistre une pièce avec sa direction d'éclatement. */
  _part(mesh, dir) {
    mesh.userData.basePos = mesh.position.clone();
    mesh.userData.dir = dir.clone().normalize();
    this.group.add(mesh);
    this.parts.push(mesh);
    return mesh;
  }

  _build() {
    const M = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
      m.castShadow = true;
      return m;
    };

    // Bloc-cylindres central
    this._part(M(new THREE.BoxGeometry(0.62, 0.34, 0.44), this.mats.block, 0, 0, 0), new THREE.Vector3(0, 0, 0));

    // Carter d'huile
    this._part(M(new THREE.BoxGeometry(0.5, 0.14, 0.3), this.mats.alu, 0, -0.26, 0), new THREE.Vector3(0, -1, 0));

    // Culasses inclinées (architecture en V)
    this._part(
      M(new THREE.BoxGeometry(0.58, 0.13, 0.24), this.mats.alu, 0, 0.21, 0.16, -0.45),
      new THREE.Vector3(0, 0.6, 1)
    );
    this._part(
      M(new THREE.BoxGeometry(0.58, 0.13, 0.24), this.mats.alu, 0, 0.21, -0.16, 0.45),
      new THREE.Vector3(0, 0.6, -1)
    );

    // Caches-culbuteurs rouges « 5.0 »
    this._part(
      M(new THREE.BoxGeometry(0.56, 0.07, 0.20), this.mats.cover, 0, 0.31, 0.21, -0.45),
      new THREE.Vector3(0, 1, 1.4)
    );
    this._part(
      M(new THREE.BoxGeometry(0.56, 0.07, 0.20), this.mats.cover, 0, 0.31, -0.21, 0.45),
      new THREE.Vector3(0, 1, -1.4)
    );

    // Collecteur d'admission
    this._part(M(new THREE.BoxGeometry(0.44, 0.10, 0.26), this.mats.dark, 0, 0.35, 0), new THREE.Vector3(0, 1.8, 0));
    // Corps de papillon
    this._part(M(new THREE.CylinderGeometry(0.06, 0.06, 0.10, 18), this.mats.alu, 0.28, 0.38, 0, 0, 0, Math.PI / 2), new THREE.Vector3(1, 2, 0));

    // Poulies & accessoires en façade
    for (const [y, z, r] of [[0.02, 0.10, 0.07], [-0.08, -0.10, 0.055], [0.13, -0.04, 0.045]]) {
      this._part(
        M(new THREE.CylinderGeometry(r, r, 0.05, 20), this.mats.chrome, 0.36, y, z, 0, 0, Math.PI / 2),
        new THREE.Vector3(1.6, y * 2, z * 2)
      );
    }

    // Collecteurs d'échappement (4 tubes par banc)
    const tubeGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.22, 12);
    for (const side of [1, -1]) {
      for (let i = 0; i < 4; i++) {
        this._part(
          M(tubeGeo, this.mats.steel ?? this.mats.alu, -0.21 + i * 0.14, -0.02, side * 0.28, side * 1.1),
          new THREE.Vector3(0, -0.3, side * 1.8)
        );
      }
    }

    // Volant moteur à l'arrière
    this._part(
      M(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 24), this.mats.dark, -0.38, 0, 0, 0, 0, Math.PI / 2),
      new THREE.Vector3(-1.8, 0, 0)
    );
  }

  /**
   * Remplace le V8 procédural par les pièces clonées du modèle 3D
   * (bloc, compresseur, radiateur, boîte…), déjà positionnées
   * relativement au centre du bloc moteur.
   * @param {{mesh: THREE.Object3D, dir: THREE.Vector3}[]} parts
   */
  adopt(parts) {
    if (!parts?.length) return;
    this.group.clear();
    this.parts = [];
    for (const { mesh, dir } of parts) {
      mesh.userData.basePos = mesh.position.clone();
      mesh.userData.dir = dir.lengthSq() > 0 ? dir.clone().normalize() : dir.clone();
      mesh.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.group.add(mesh);
      this.parts.push(mesh);
    }
  }

  /** Apparition / disparition (pilotée par GSAP dans main.js). */
  setVisibility(v) {
    this.visibility = v;
    this.group.visible = v > 0.01;
    const s = 0.001 + v * 0.999;
    this.group.scale.setScalar(s);
  }

  /** Séparation des pièces [0..1] — pilotée par le scroll. */
  setExplode(p) {
    const amount = p * 0.3;
    for (const part of this.parts) {
      part.position.copy(part.userData.basePos).addScaledVector(part.userData.dir, amount);
    }
  }

  /** Lente rotation de présentation. */
  update(dt) {
    if (this.group.visible) this.group.rotation.y += dt * 0.25;
  }
}
