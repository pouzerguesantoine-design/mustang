/**
 * Experience.js — Chef d'orchestre WebGL.
 *
 * Renderer, scène, caméra, post-processing (bloom), boucle de rendu,
 * adaptation automatique de la qualité selon le framerate,
 * et coordination de tous les sous-systèmes 3D.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { Environment } from './Environment.js';
import { Car } from './Car.js';
import { Engine } from './Engine.js';
import { Particles } from './Particles.js';
import { Smoke } from './Smoke.js';
import { CameraDirector } from './CameraDirector.js';
import { QUALITY } from '../config.js';

export class Experience {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {(p:number)=>void} [onModelProgress] progression du modèle 3D [0..1]
   */
  constructor(canvas, onModelProgress) {
    this.canvas = canvas;
    this.onModelProgress = onModelProgress;
    this.clock = new THREE.Clock();

    // État piloté par les ScrollTriggers (main.js)
    this.state = {
      progress: 0,     // scroll global 0..1
      explode: 0,      // vue éclatée moteur
      interior: 0,     // immersion habitacle (fondu du vitrage)
      perf: 0,         // scène performance (vitesse)
      finale: 0,       // départ final
      scrollVelocity: 0,
    };
    this.mouse = { x: 0, y: 0 };

    this._fpsSamples = [];
    this._quality = 2;   // 2 = full, 1 = sans bloom, 0 = sans post

    this._initRenderer();
    this._initScene();
    this._initPost();
    this._bindEvents();

    // Boucle de rendu synchronisée avec GSAP (un seul ticker)
    gsap.ticker.add(() => this._tick());
  }

  /* ── Init ───────────────────────────────────────────────── */

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, antialias: true, powerPreference: 'high-performance',
    });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, QUALITY.maxPixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.08, 120);

    this.environment = new Environment(this.scene, this.renderer);
    this.car = new Car(this.scene, this.onModelProgress);
    this.engine = new Engine(this.scene);
    this.particles = new Particles(this.scene);
    this.smoke = new Smoke(this.scene, this.car);
    this.director = new CameraDirector(this.camera);
    this.director.setAspect(this.camera.aspect);

    // Une fois le modèle chargé : vraie vue éclatée + lumière d'habitacle
    this.car.ready.then(() => {
      this.engine.adopt(this.car.engineParts);
      this.car.attachInteriorLight();
    });
  }

  _initPost() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(innerWidth, innerHeight), 0.3, 0.7, 0.85
    );
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  _bindEvents() {
    addEventListener('resize', () => {
      if (!innerWidth || !innerHeight) return;   // onglet masqué
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.director.setAspect(this.camera.aspect);
      this.renderer.setSize(innerWidth, innerHeight);
      this.composer.setSize(innerWidth, innerHeight);
    });

    addEventListener('pointermove', (e) => {
      this.mouse.x = (e.clientX / innerWidth) * 2 - 1;
      this.mouse.y = -((e.clientY / innerHeight) * 2 - 1);
      this.environment.setMouse(this.mouse.x, this.mouse.y);
    }, { passive: true });
  }

  /* ── API ────────────────────────────────────────────────── */

  setProgress(p) {
    this.state.progress = p;
    this.director.setProgress(p);
  }

  buildCameraPath(ranges) { this.director.build(ranges); }

  /** RPM normalisé [0..1] pour le son moteur. */
  get rpm() {
    const s = this.state;
    const launch = s.finale > 0.35 ? Math.min((s.finale - 0.35) / 0.3, 1) : 0;
    return Math.min(1, 0.12 + Math.abs(s.scrollVelocity) * 0.35 + s.perf * 0.55 + launch);
  }

  /* ── Boucle de rendu ────────────────────────────────────── */

  _tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.elapsedTime;
    const s = this.state;

    /* Caméra */
    this.director.update(dt);
    this.director.applyMouseParallax(this.mouse.x, this.mouse.y);

    /* Départ final : la Mustang s'élance et disparaît */
    let launchDist = 0, launchSpeed = 0;
    if (s.finale > 0.30) {
      const l = Math.min((s.finale - 0.30) / 0.55, 1);
      const eased = l * l * l;                 // accélération progressive
      launchDist = eased * 70;
      launchSpeed = l * 90;
    }
    this.car.group.position.x = launchDist;

    /* Voiture : roues, suspension, vibrations */
    const wheelSpeed = 0.6 + Math.abs(s.scrollVelocity) * 14 + s.perf * 42 + launchSpeed;
    const vibration = Math.max(s.perf, s.finale > 0.3 ? 0.8 : 0);
    this.car.update(dt, elapsed, wheelSpeed, vibration);

    /* Vitrage : fondu quand la caméra entre dans l'habitacle */
    const glassTarget = s.interior > 0.35 && s.interior < 0.98 ? 0.1 : 0.92;
    this.car.mats.glass.opacity += (glassTarget - this.car.mats.glass.opacity) * Math.min(dt * 5, 1);

    /* Fumée d'échappement : ralenti au début, burst au départ */
    const heroIdle = s.progress < 0.10 ? 6 : 0;
    const finaleBurst = (s.finale > 0.25 && s.finale < 0.75) ? 26 : 0;
    this.smoke.emitRate = heroIdle + finaleBurst;
    this.smoke.update(dt);

    /* Particules & environnement */
    this.particles.speedFactor = Math.max(s.perf, s.finale > 0.3 ? 1 : 0);
    this.particles.update(dt, elapsed);
    this.environment.update(dt, elapsed);

    /* Moteur en vue éclatée */
    this.engine.setExplode(s.explode);
    this.engine.update(dt);

    /* Rendu (avec ou sans post selon la qualité mesurée) */
    if (this._quality > 0) this.composer.render();
    else this.renderer.render(this.scene, this.camera);

    this._monitorPerformance(dt);
  }

  /* ── Adaptation automatique de la qualité ───────────────── */

  _monitorPerformance(dt) {
    this._fpsSamples.push(1 / Math.max(dt, 1e-4));
    if (this._fpsSamples.length < 120) return;

    const avg = this._fpsSamples.reduce((a, b) => a + b, 0) / this._fpsSamples.length;
    this._fpsSamples.length = 0;

    if (avg < QUALITY.fpsDropPost && this._quality > 0) {
      this._quality = 0;
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
      console.info('[Mustang] Qualité réduite : post-processing désactivé');
    } else if (avg < QUALITY.fpsDropBloom && this._quality > 1) {
      this._quality = 1;
      this.bloom.enabled = false;
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
      console.info('[Mustang] Qualité réduite : bloom désactivé');
    }
  }
}
