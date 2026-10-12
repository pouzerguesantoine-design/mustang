/**
 * Environment.js — Studio virtuel : éclairage HDR (RoomEnvironment via PMREM),
 * sol réfléchissant, brouillard cinématique, lumières d'accent
 * et lumière interactive suivant la souris.
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export class Environment {
  constructor(scene, renderer) {
    this.scene = scene;

    /* — Environnement HDR procédural (réflexions PBR) — */
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.5;
    pmrem.dispose();

    /* — Brouillard : profondeur & mystère — */
    scene.fog = new THREE.FogExp2(0x050505, 0.038);
    scene.background = new THREE.Color(0x050505);

    /* — Sol studio réfléchissant — */
    const floorTex = this._makeFloorTexture();
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(70, 64),
      new THREE.MeshStandardMaterial({
        map: floorTex,
        metalness: 0.72, roughness: 0.38,
        envMapIntensity: 0.7,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    /* — Lumière clé (douche studio, ombres douces) — */
    const key = new THREE.DirectionalLight(0xf5f2ea, 2.4);
    key.position.set(4, 8, 3);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 25;
    key.shadow.camera.left = -6; key.shadow.camera.right = 6;
    key.shadow.camera.top = 6; key.shadow.camera.bottom = -6;
    key.shadow.bias = -0.0004;
    key.shadow.radius = 6;
    scene.add(key);

    /* — Contre-jour rouge Mustang (arrière) — */
    this.rimRed = new THREE.PointLight(0xe01e2b, 42, 30, 2.0);
    this.rimRed.position.set(-6, 3.4, -4);
    scene.add(this.rimRed);

    /* — Accent froid acier (avant gauche) — */
    this.rimCool = new THREE.PointLight(0x7fa8ff, 34, 26, 1.8);
    this.rimCool.position.set(6, 2.6, 4.5);
    scene.add(this.rimCool);

    /* — Douce lumière zénithale — */
    const top = new THREE.PointLight(0xffffff, 26, 20, 2);
    top.position.set(0, 6, 0);
    scene.add(top);

    /* — Lumière interactive suivant la souris — */
    this.mouseLight = new THREE.PointLight(0xfff4e0, 18, 14, 2);
    this.mouseLight.position.set(3, 2, 3);
    scene.add(this.mouseLight);
    this._mouseTarget = new THREE.Vector3(3, 2, 3);
  }

  /** Cible de la lumière souris (coordonnées normalisées -1..1). */
  setMouse(nx, ny) {
    this._mouseTarget.set(nx * 6, 1.6 + ny * 1.4, 4.5);
  }

  update(dt, elapsed) {
    // Amortissement de la lumière souris
    this.mouseLight.position.lerp(this._mouseTarget, 1 - Math.exp(-dt * 4));
    // Respiration subtile des accents colorés
    this.rimRed.intensity = 42 + Math.sin(elapsed * 0.8) * 9;
    this.rimCool.intensity = 34 + Math.sin(elapsed * 0.6 + 2) * 8;
  }

  /** Sol : dégradé radial généré (tache de lumière centrale). */
  _makeFloorTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(256, 256, 20, 256, 256, 256);
    g.addColorStop(0, '#232326');
    g.addColorStop(0.35, '#111113');
    g.addColorStop(1, '#050505');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
}
