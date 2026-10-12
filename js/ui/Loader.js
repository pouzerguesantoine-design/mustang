/**
 * Loader.js — Écran de chargement premium.
 *
 * Barre de progression + pourcentage, puis séquence d'introduction :
 * le rideau se lève, les phares s'allument, le titre se révèle.
 */

/**
 * @param {Promise} readyPromise  résolue quand le modèle 3D est chargé
 * @param {()=>number} getProgress progression réelle du téléchargement [0..1]
 * @param {()=>void} onComplete
 */
export function runLoader(readyPromise, getProgress, onComplete) {
  const loader = document.getElementById('loader');
  const bar = document.getElementById('loader-bar');
  const percent = document.getElementById('loader-percent');

  const state = { fake: 0, shown: 0 };
  const render = () => {
    // La barre suit le max entre la rampe minimale et la vraie progression
    const real = getProgress() * 100;
    state.shown = Math.max(state.shown, Math.max(Math.min(state.fake, 92), Math.min(real, 99)));
    percent.textContent = String(Math.round(state.shown)).padStart(3, '0');
    bar.style.transform = `scaleX(${state.shown / 100})`;
  };

  // Rampe d'attente (plafonnée à 92 % tant que le modèle télécharge)
  const ramp = gsap.to(state, { fake: 100, duration: 2.6, ease: 'power2.inOut', onUpdate: render });

  const exit = () => {
    ramp.kill();
    const tl = gsap.timeline();
    tl.to(state, {
      shown: 100, duration: 0.5, ease: 'power2.out',
      onUpdate() {
        percent.textContent = String(Math.round(state.shown)).padStart(3, '0');
        bar.style.transform = `scaleX(${state.shown / 100})`;
      },
    });
    tl.to('.loader__inner', { opacity: 0, y: -30, duration: 0.7, ease: 'power3.in' }, '+=0.2');
    tl.to(loader, {
      yPercent: -100, duration: 1.1, ease: 'power4.inOut',
      onComplete() {
        loader.style.display = 'none';
        loader.setAttribute('aria-hidden', 'true');
      },
    }, '-=0.15');
    tl.add(() => onComplete?.(), '-=0.9');
  };

  // On attend à la fois la fin de la rampe minimale et le modèle
  readyPromise.then(() => {
    if (ramp.progress() > 0.8) exit();
    else ramp.eventCallback('onComplete', exit);
  });
}

/** Séquence d'intro du hero (après le loader). */
export function runIntro(experience, reducedMotion) {
  const tl = gsap.timeline();

  // Les phares s'allument, le moteur « démarre » (fumée gérée par Experience)
  const lights = { v: 0 };
  tl.to(lights, {
    v: 1, duration: 1.6, ease: 'power2.inOut',
    onUpdate: () => experience.car.setLights(lights.v),
  }, 0.2);
  // Double appel de phares, comme un clin d'œil
  tl.to(lights, { v: 0.25, duration: 0.09, repeat: 1, yoyo: true, onUpdate: () => experience.car.setLights(lights.v) }, 1.9);

  if (reducedMotion) {
    gsap.set(['.hero__title-line span', '.reveal-line > span', '.hero__meta', '.hero__scroll'], { opacity: 1, y: 0 });
    return tl;
  }

  // Révélation typographique
  tl.from('.hero__title-line span', {
    yPercent: 110, duration: 1.3, stagger: 0.12, ease: 'power4.out',
  }, 0.35);
  tl.from('.reveal-line > span', {
    yPercent: 120, duration: 1, stagger: 0.15, ease: 'power3.out',
  }, 0.7);
  tl.from('.hero__meta', { opacity: 0, y: 26, duration: 1, ease: 'power3.out' }, 1.2);
  tl.from('.hero__scroll', { opacity: 0, duration: 1 }, 1.7);
  tl.from('.nav', { yPercent: -100, opacity: 0, duration: 1, ease: 'power3.out' }, 0.9);

  return tl;
}
