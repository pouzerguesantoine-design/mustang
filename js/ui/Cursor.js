/**
 * Cursor.js — Curseur personnalisé + boutons magnétiques + cartes 3D.
 *
 * Le point suit la souris instantanément, l'anneau avec un retard
 * élastique. Les éléments .magnetic attirent le curseur ; les
 * cartes .tilt s'inclinent en 3D au survol.
 */

export function initCursor() {
  const root = document.getElementById('cursor');
  if (!root || matchMedia('(hover: none)').matches) return;

  const dot = root.querySelector('.cursor__dot');
  const ring = root.querySelector('.cursor__ring');

  const pos = { x: innerWidth / 2, y: innerHeight / 2 };
  const ringPos = { x: pos.x, y: pos.y };

  addEventListener('pointermove', (e) => {
    pos.x = e.clientX; pos.y = e.clientY;
    dot.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%)`;
  }, { passive: true });

  // L'anneau rattrape le point avec inertie
  gsap.ticker.add(() => {
    ringPos.x += (pos.x - ringPos.x) * 0.14;
    ringPos.y += (pos.y - ringPos.y) * 0.14;
    ring.style.transform = `translate(${ringPos.x}px, ${ringPos.y}px) translate(-50%, -50%)`;
  });

  // Grossissement au survol des éléments interactifs
  const interactive = 'a, button, .swatch, .config-pill, .ambient-btn';
  document.addEventListener('pointerover', (e) => {
    if (e.target.closest(interactive)) root.classList.add('is-hover');
  });
  document.addEventListener('pointerout', (e) => {
    if (e.target.closest(interactive)) root.classList.remove('is-hover');
  });
}

/** Attraction magnétique des éléments .magnetic. */
export function initMagnetic() {
  if (matchMedia('(hover: none)').matches) return;

  for (const el of document.querySelectorAll('.magnetic')) {
    const strength = 0.35;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      gsap.to(el, { x: dx * strength, y: dy * strength, duration: 0.4, ease: 'power2.out' });
    });
    el.addEventListener('pointerleave', () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.4)' });
    });
  }
}

/** Inclinaison 3D des cartes .tilt (galerie). */
export function initTilt() {
  if (matchMedia('(hover: none)').matches) return;

  for (const card of document.querySelectorAll('.tilt')) {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      gsap.to(card, {
        rotateY: nx * 14, rotateX: -ny * 12, scale: 1.03,
        transformPerspective: 700, duration: 0.5, ease: 'power2.out',
      });
    });
    card.addEventListener('pointerleave', () => {
      gsap.to(card, { rotateY: 0, rotateX: 0, scale: 1, duration: 0.9, ease: 'elastic.out(1, 0.5)' });
    });
  }
}
