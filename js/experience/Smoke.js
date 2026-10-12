/**
 * Smoke.js — Fumée d'échappement (pool de sprites).
 *
 * Des sprites doux (texture canvas générée) naissent aux sorties
 * d'échappement, s'élèvent, grossissent et s'estompent.
 * L'intensité d'émission est pilotée par l'expérience
 * (ralenti au démarrage, burst lors du départ final).
 */

import * as THREE from 'three';

const POOL = 48;

export class Smoke {
  constructor(scene, car) {
    this.car = car;
    this.emitRate = 0;          // particules / seconde
    this._accumulator = 0;
    this._cursor = 0;

    const tex = this._makeTexture();
    this.sprites = [];

    for (let i = 0; i < POOL; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, color: 0x8b8f96, transparent: true, opacity: 0,
        depthWrite: false,
      }));
      sprite.scale.setScalar(0.001);
      sprite.userData = { life: 0, maxLife: 1, vel: new THREE.Vector3() };
      scene.add(sprite);
      this.sprites.push(sprite);
    }

    this._worldPos = new THREE.Vector3();
  }

  _makeTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  /** Fait naître une particule à une sortie d'échappement aléatoire. */
  _spawn() {
    const tips = this.car.exhaustTips;
    if (!tips.length) return;   // modèle pas encore chargé

    const sprite = this.sprites[this._cursor];
    this._cursor = (this._cursor + 1) % POOL;
    const tip = tips[Math.floor(Math.random() * tips.length)];
    tip.getWorldPosition(this._worldPos);

    sprite.position.copy(this._worldPos);
    sprite.position.x -= 0.1;
    sprite.userData.life = 0;
    sprite.userData.maxLife = 1.4 + Math.random() * 1.2;
    sprite.userData.vel.set(
      -0.5 - Math.random() * 0.6,
      0.25 + Math.random() * 0.3,
      (Math.random() - 0.5) * 0.3
    );
    sprite.scale.setScalar(0.06);
  }

  update(dt) {
    // Émission continue selon le débit demandé
    this._accumulator += this.emitRate * dt;
    while (this._accumulator >= 1) {
      this._spawn();
      this._accumulator -= 1;
    }

    // Vie des particules : montée, expansion, fondu
    for (const s of this.sprites) {
      const d = s.userData;
      if (d.life >= d.maxLife) { s.material.opacity = 0; continue; }
      d.life += dt;
      const t = d.life / d.maxLife;
      s.position.addScaledVector(d.vel, dt);
      s.scale.setScalar(0.06 + t * 0.85);
      s.material.opacity = Math.sin(Math.min(t, 1) * Math.PI) * 0.32;
    }
  }
}
