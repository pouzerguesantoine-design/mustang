/**
 * Particles.js — Poussière atmosphérique 3D.
 *
 * Au repos : particules en lente dérive (ambiance studio).
 * Scène performance / finale : elles filent vers l'arrière,
 * créant un effet de vitesse type « warp ».
 */

import * as THREE from 'three';

const COUNT = 700;
const BOUNDS = { x: 34, y: 9, z: 26 };

export class Particles {
  constructor(scene) {
    this.speedFactor = 0;   // 0 = dérive lente, 1 = pleine vitesse

    const positions = new Float32Array(COUNT * 3);
    const seeds = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * BOUNDS.x;
      positions[i * 3 + 1] = Math.random() * BOUNDS.y + 0.1;
      positions[i * 3 + 2] = (Math.random() - 0.5) * BOUNDS.z;
      seeds[i] = Math.random();
    }
    this.seeds = seeds;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.mat = new THREE.PointsMaterial({
      color: 0xaab2be, size: 0.045, sizeAttenuation: true,
      map: this._makeDotTexture(), transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });

    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  /** Point doux circulaire (les Points par défaut sont carrés). */
  _makeDotTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.4)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  }

  update(dt, elapsed) {
    const pos = this.points.geometry.attributes.position;
    const speed = 0.25 + this.speedFactor * 55;

    for (let i = 0; i < COUNT; i++) {
      let x = pos.getX(i);
      // Les particules filent vers -X (la voiture « avance » vers +X)
      x -= speed * dt * (0.6 + this.seeds[i] * 0.8);
      // Dérive verticale douce au repos
      const y = pos.getY(i) + Math.sin(elapsed * 0.6 + this.seeds[i] * 20) * dt * 0.05;
      if (x < -BOUNDS.x / 2) x += BOUNDS.x;
      pos.setX(i, x);
      pos.setY(i, y);
    }
    pos.needsUpdate = true;

    // Plus de vitesse = particules plus visibles et brillantes
    this.mat.opacity = 0.5 + this.speedFactor * 0.4;
    this.mat.size = 0.035 + this.speedFactor * 0.06;
  }
}
