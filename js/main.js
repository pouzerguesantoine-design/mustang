/**
 * main.js — Point d'entrée & orchestration.
 *
 * - Scroll fluide (Lenis) synchronisé avec GSAP ScrollTrigger
 * - Chorégraphie scroll → caméra 3D (via Experience / CameraDirector)
 * - Animations DOM de chaque scène
 * - Configurateur temps réel, compteurs, son moteur
 */

import { Experience } from './experience/Experience.js';
import { EngineSound } from './audio/EngineSound.js';
import { runLoader, runIntro } from './ui/Loader.js';
import { initCursor, initMagnetic, initTilt } from './ui/Cursor.js';
import { PAINTS, CALIPERS, WHEELS, SPOILER_PRICE, BASE_PRICE } from './config.js';

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ═══════════════ SCROLL FLUIDE (LENIS) ═══════════════ */

let lenis = null;
if (!reducedMotion) {
  lenis = new Lenis({ lerp: 0.08, wheelMultiplier: 0.9 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

/* ═══════════════ EXPÉRIENCE 3D ═══════════════ */

let modelProgress = 0;
const experience = new Experience(
  document.getElementById('webgl'),
  (p) => { modelProgress = p; }
);
const engineSound = new EngineSound();
window.__mustang = experience;   // poignées de debug (console)
window.__lenis = lenis;

// Vélocité de scroll → rotation des roues + régime moteur
if (lenis) {
  lenis.on('scroll', (e) => {
    experience.state.scrollVelocity = gsap.utils.clamp(-1, 1, e.velocity / 60);
  });
}
gsap.ticker.add(() => {
  experience.state.scrollVelocity *= 0.94;   // retour au calme
  engineSound.setRpm(experience.rpm);
});

/* ═══════════════ TRAJECTOIRE CAMÉRA ← SECTIONS DOM ═══════════════ */

/** Plage de scroll normalisée [0..1] occupée par une section. */
function sectionRange(id) {
  const el = document.getElementById(id);
  const scrollable = document.documentElement.scrollHeight - innerHeight;
  const start = Math.max(0, (el.offsetTop - innerHeight * 0.4) / scrollable);
  const end = Math.min(1, (el.offsetTop + el.offsetHeight - innerHeight) / scrollable);
  return [start, end];
}

function buildCameraPath() {
  experience.buildCameraPath({
    hero: sectionRange('hero'),
    design: sectionRange('design'),
    engine: sectionRange('moteur'),
    interior: sectionRange('interieur'),
    perf: sectionRange('performance'),
    gallery: sectionRange('galerie'),
    config: sectionRange('configurateur'),
    finale: sectionRange('final'),
  });
}
buildCameraPath();
ScrollTrigger.addEventListener('refresh', buildCameraPath);

/* ═══════════════ PROGRESSION GLOBALE ═══════════════ */

ScrollTrigger.create({
  trigger: document.body,
  start: 'top top',
  end: 'bottom bottom',
  onUpdate(self) {
    experience.setProgress(self.progress);
    document.getElementById('scroll-progress').style.transform = `scaleX(${self.progress})`;
    document.getElementById('nav').classList.toggle('is-scrolled', self.progress > 0.005);
  },
});

/* ═══════════════ SCÈNE 1 — HERO (sortie) ═══════════════ */

gsap.to('.hero__content', {
  autoAlpha: 0, y: -60, ease: 'none',
  scrollTrigger: { trigger: '#hero', start: '12% top', end: '35% top', scrub: true },
});
gsap.to('.hero__scroll', {
  autoAlpha: 0, ease: 'none',
  scrollTrigger: { trigger: '#hero', start: 'top top', end: '8% top', scrub: true },
});

/* ═══════════════ TITRES DE SECTION (entrée / sortie) ═══════════════ */

for (const id of ['design', 'moteur', 'interieur', 'performance', 'galerie', 'configurateur']) {
  const head = `#${id} .section__head`;
  gsap.timeline({
    scrollTrigger: { trigger: `#${id}`, start: 'top bottom', end: 'bottom top', scrub: true },
  })
    .fromTo(head, { autoAlpha: 0, y: 90 }, { autoAlpha: 1, y: 0, duration: 0.14, ease: 'none' }, 0.06)
    .to(head, { autoAlpha: 0, y: -60, duration: 0.1, ease: 'none' }, 0.86);
}

/* ═══════════════ SCÈNE 2 — DESIGN : cartes séquencées ═══════════════ */

{
  const cards = gsap.utils.toArray('.design-card');
  const tl = gsap.timeline({
    scrollTrigger: { trigger: '#design', start: 'top top', end: 'bottom bottom', scrub: true },
  });
  const seg = 1 / cards.length;
  cards.forEach((card, i) => {
    tl.fromTo(card,
      { autoAlpha: 0, y: 60, rotateX: 8 },
      { autoAlpha: 1, y: 0, rotateX: 0, duration: seg * 0.35, ease: 'none' }, i * seg + seg * 0.1);
    tl.to(card, { autoAlpha: 0, y: -50, duration: seg * 0.3, ease: 'none' }, i * seg + seg * 0.62);
  });
}

/* ═══════════════ SCÈNE 3 — MOTEUR : vue éclatée + stats ═══════════════ */

{
  const vis = { v: 0 };
  const setVis = (target) => gsap.to(vis, {
    v: target, duration: 0.9, ease: 'power3.out', overwrite: true,
    onUpdate: () => experience.engine.setVisibility(vis.v),
  });

  ScrollTrigger.create({
    trigger: '#moteur', start: 'top 60%', end: 'bottom 40%',
    onEnter: () => setVis(1),
    onLeave: () => setVis(0),
    onEnterBack: () => setVis(1),
    onLeaveBack: () => setVis(0),
    onUpdate(self) { experience.state.explode = self.progress; },
  });

  // Compteurs animés + apparition des cartes stats
  ScrollTrigger.create({
    trigger: '.engine__stats', start: 'top 90%', once: true,
    onEnter() {
      gsap.to('.stat', { opacity: 1, y: 0, duration: 1, stagger: 0.1, ease: 'power3.out' });
      animateCounters(document.querySelector('.engine__stats'));
    },
  });
}

/** Anime tous les [data-counter] d'un conteneur (format français). */
function animateCounters(container) {
  for (const el of container.querySelectorAll('[data-counter]')) {
    const target = parseFloat(el.dataset.counter);
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const obj = { v: 0 };
    gsap.to(obj, {
      v: target, duration: 1.8, ease: 'power2.out',
      onUpdate: () => { el.textContent = obj.v.toFixed(decimals).replace('.', ','); },
    });
  }
}

/* ═══════════════ SCÈNE 4 — INTÉRIEUR ═══════════════ */

ScrollTrigger.create({
  trigger: '#interieur', start: 'top 50%', end: 'bottom 50%',
  onUpdate(self) { experience.state.interior = self.progress; },
  onLeave() { experience.state.interior = 0; },
  onLeaveBack() { experience.state.interior = 0; },
});

gsap.to('.interior__panel', {
  opacity: 1, y: 0, duration: 1.1, ease: 'power3.out',
  scrollTrigger: { trigger: '#interieur', start: 'top 45%' },
});

// Boutons d'ambiance lumineuse → habitacle 3D
for (const btn of document.querySelectorAll('.ambient-btn')) {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ambient-btn').forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    experience.car.setAmbient(btn.dataset.ambient);
  });
}

/* ═══════════════ SCÈNE 5 — PERFORMANCE ═══════════════ */

{
  const fill = document.getElementById('speedo-fill');
  const needle = document.getElementById('speedo-needle');
  const value = document.getElementById('speedo-value');
  const overlay = document.getElementById('speed-overlay');
  const len = fill.getTotalLength();
  fill.style.strokeDasharray = len;
  fill.style.strokeDashoffset = len;

  ScrollTrigger.create({
    trigger: '#performance', start: 'top 40%', end: 'bottom 70%',
    onUpdate(self) {
      const p = self.progress;
      experience.state.perf = p;
      const kmh = Math.round(gsap.parseEase('power2.inOut')(p) * 290);
      value.textContent = kmh;
      fill.style.strokeDashoffset = len * (1 - p);
      needle.style.transform = `rotate(${-120 + p * 240}deg)`;
      overlay.style.opacity = Math.sin(p * Math.PI) * 0.9;
    },
    onLeave() { experience.state.perf = 0; overlay.style.opacity = 0; },
    onLeaveBack() { experience.state.perf = 0; overlay.style.opacity = 0; },
  });

  ScrollTrigger.create({
    trigger: '.performance__bars', start: 'top 92%', once: true,
    onEnter() {
      for (const bar of document.querySelectorAll('.perf-bar__fill')) {
        gsap.to(bar, { width: `${bar.dataset.width}%`, duration: 1.4, ease: 'power3.inOut' });
      }
    },
  });
}

/* ═══════════════ SCÈNE 6 — GALERIE ═══════════════ */

{
  const cards = gsap.utils.toArray('.gallery-card');

  gsap.to(cards, {
    opacity: 1, duration: 1.2, stagger: 0.08, ease: 'power2.out',
    scrollTrigger: { trigger: '.gallery__grid', start: 'top 80%' },
  });

  // Parallaxe : chaque carte flotte à sa propre profondeur
  for (const card of cards) {
    const depth = parseFloat(card.dataset.depth || '1');
    gsap.fromTo(card, { y: depth * 90 }, {
      y: depth * -90, ease: 'none',
      scrollTrigger: { trigger: '#galerie', start: 'top bottom', end: 'bottom top', scrub: true },
    });
  }
}

/* ═══════════════ SCÈNE 7 — CONFIGURATEUR ═══════════════ */

const configState = { paint: PAINTS[0], wheel: 'sport', caliper: CALIPERS[0], spoiler: true };

function updatePrice() {
  const total = BASE_PRICE
    + configState.paint.price
    + WHEELS[configState.wheel].price
    + configState.caliper.price
    + (configState.spoiler ? SPOILER_PRICE : 0);

  const el = document.getElementById('config-price');
  const from = parseInt(el.textContent.replace(/\D/g, ''), 10) || total;
  const obj = { v: from };
  gsap.to(obj, {
    v: total, duration: 0.7, ease: 'power2.out',
    onUpdate: () => { el.textContent = new Intl.NumberFormat('fr-FR').format(Math.round(obj.v)); },
  });
}

function buildSwatches(containerId, items, onPick, activeId) {
  const container = document.getElementById(containerId);
  for (const item of items) {
    const b = document.createElement('button');
    b.className = 'swatch magnetic' + (item.id === activeId ? ' is-active' : '');
    b.style.setProperty('--swatch', item.hex);
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(item.id === activeId));
    b.setAttribute('aria-label', item.name);
    b.addEventListener('click', () => {
      container.querySelectorAll('.swatch').forEach((s) => {
        s.classList.remove('is-active');
        s.setAttribute('aria-checked', 'false');
      });
      b.classList.add('is-active');
      b.setAttribute('aria-checked', 'true');
      onPick(item);
    });
    container.appendChild(b);
  }
}

buildSwatches('config-paint', PAINTS, (paint) => {
  configState.paint = paint;
  experience.car.setPaint(paint.hex);
  document.getElementById('paint-name').textContent = paint.name;
  updatePrice();
}, 'race-red');

buildSwatches('config-calipers', CALIPERS, (caliper) => {
  configState.caliper = caliper;
  experience.car.setCalipers(caliper.hex);
  updatePrice();
}, 'red');

for (const btn of document.querySelectorAll('[data-wheel]')) {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-wheel]').forEach((b) => {
      b.classList.remove('is-active'); b.setAttribute('aria-checked', 'false');
    });
    btn.classList.add('is-active'); btn.setAttribute('aria-checked', 'true');
    configState.wheel = btn.dataset.wheel;
    experience.car.setWheelStyle(configState.wheel);
    updatePrice();
  });
}

for (const btn of document.querySelectorAll('[data-spoiler]')) {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-spoiler]').forEach((b) => {
      b.classList.remove('is-active'); b.setAttribute('aria-checked', 'false');
    });
    btn.classList.add('is-active'); btn.setAttribute('aria-checked', 'true');
    configState.spoiler = btn.dataset.spoiler === 'on';
    experience.car.setSpoiler(configState.spoiler);
    updatePrice();
  });
}

updatePrice();

gsap.to('.configurator__panel', {
  opacity: 1, y: 0, duration: 1.1, ease: 'power3.out',
  scrollTrigger: { trigger: '#configurateur', start: 'top 45%' },
});

/* ═══════════════ SCÈNE 8 — FINALE ═══════════════ */

{
  const blackout = document.getElementById('blackout');

  ScrollTrigger.create({
    trigger: '#final', start: 'top 60%', end: 'bottom bottom',
    onUpdate(self) {
      const p = self.progress;
      experience.state.finale = p;
      // Fondu au noir pendant que la Mustang disparaît
      blackout.style.opacity = gsap.utils.clamp(0, 1, (p - 0.55) / 0.3);
    },
    onLeaveBack() { experience.state.finale = 0; blackout.style.opacity = 0; },
  });

  // Révélation du contenu final au-dessus du noir
  gsap.timeline({
    scrollTrigger: { trigger: '#final', start: '55% bottom', end: '95% bottom', scrub: true },
  })
    .to('.finale__emblem', { opacity: 1, duration: 0.3 }, 0.1)
    .to('.finale__title', { opacity: 1, duration: 0.35 }, 0.25)
    .to('.finale__sub', { opacity: 1, duration: 0.3 }, 0.45)
    .to('.btn-cta', { opacity: 1, duration: 0.3 }, 0.6);
}

/* ═══════════════ NAVIGATION & SON ═══════════════ */

// Ancres fluides via Lenis
for (const link of document.querySelectorAll('a[href^="#"]')) {
  link.addEventListener('click', (e) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { duration: 2, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else target.scrollIntoView({ behavior: 'smooth' });
  });
}

// Bouton son moteur
const soundBtn = document.getElementById('sound-toggle');
soundBtn.addEventListener('click', () => {
  const on = engineSound.toggle();
  soundBtn.setAttribute('aria-pressed', String(on));
  soundBtn.setAttribute('aria-label', on ? 'Couper le son du moteur' : 'Activer le son du moteur');
});

/* ═══════════════ MICRO-INTERACTIONS ═══════════════ */

initCursor();
initMagnetic();
initTilt();

/* ═══════════════ LANCEMENT ═══════════════ */

// États initiaux (avant l'intro)
gsap.set('.nav', { yPercent: 0 });

runLoader(experience.car.ready, () => modelProgress, () => {
  ScrollTrigger.refresh();
  runIntro(experience, reducedMotion);
});
