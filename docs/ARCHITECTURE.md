# Architecture technique

Ce document explique comment le site fonctionne de l'intérieur : qui fait quoi, comment le scroll pilote la 3D, et pourquoi certains choix ont été faits.

[← Retour au README](../README.md)

---

## Vue d'ensemble

Le site est composé de **deux couches superposées** :

1. **Une scène 3D plein écran** (`<canvas id="webgl">`, fixée derrière tout le reste) dessinée par Three.js.
2. **Une page HTML classique** par-dessus, très haute (environ 25 écrans), découpée en 8 sections.

L'utilisateur fait défiler la page HTML. Ce défilement est converti en une **progression de 0 à 1** qui sert à piloter la caméra 3D et toutes les animations. Les textes de chaque section sont « collés » à l'écran (`position: sticky`) pendant que la caméra bouge derrière eux.

```
  Molette / doigt
        │
        ▼
     Lenis  ──────────────►  défilement fluide de la page
        │
        ▼
  GSAP ScrollTrigger  ─────►  progression globale (0 → 1)
        │                     + progression de chaque section
        │
        ├──► CameraDirector   position / cible / focale de la caméra
        ├──► Experience.state vitesse des roues, vue éclatée, départ final…
        └──► animations DOM   titres, cartes, compteurs, panneaux
```

---

## Les modules

### `js/main.js` — le chef d'orchestre

Point d'entrée du site. Il ne contient aucune logique 3D ; il **relie** les morceaux entre eux :

- initialise **Lenis** (scroll fluide) et le synchronise avec ScrollTrigger et le *ticker* de GSAP (une seule boucle d'animation pour tout le site) ;
- crée l'`Experience` 3D et le son du moteur ;
- calcule la plage de scroll occupée par chaque section (`sectionRange`) et la transmet au `CameraDirector` ;
- déclare tous les `ScrollTrigger` : apparition des titres, cartes du design, compteurs, vue éclatée, compteur de vitesse, galerie, fondu final ;
- branche les boutons du configurateur, de l'ambiance intérieure et du son ;
- lance l'écran de chargement, puis l'intro.

### `js/experience/Experience.js` — le moteur de rendu

Crée le *renderer* WebGL, la scène, la caméra et la chaîne de post-processing (`RenderPass → UnrealBloomPass → OutputPass`).

Il expose un objet `state` que `main.js` met à jour selon le scroll :

| Clé | Signification | Effet |
|---|---|---|
| `progress` | progression globale 0 → 1 | trajectoire de la caméra |
| `scrollVelocity` | vitesse du scroll | rotation des roues, régime moteur |
| `explode` | progression dans la scène moteur | séparation des pièces |
| `interior` | progression dans l'habitacle | transparence du vitrage |
| `perf` | progression dans la scène performance | vibrations, particules, vitesse des roues |
| `finale` | progression dans la scène finale | départ et disparition de la voiture |

À chaque image, `_tick()` lit cet état, met à jour chaque sous-système puis dessine.

**Qualité adaptative** : `_monitorPerformance()` mesure la cadence moyenne sur 120 images. Sous 42 images/s, le bloom est coupé et la résolution réduite ; sous 28 images/s, tout le post-processing et les ombres sont coupés.

### `js/experience/CameraDirector.js` — le réalisateur

La caméra suit une liste de **points clés** (*keyframes*) : à tel moment du scroll, la caméra est à telle position, regarde tel point, avec telle focale.

```js
kf(at(design, 0.28), 2.7, 0.85, 4.9,   1.45, 0.45, 0.8,  46);
//  ↑ quand           ↑ position x,y,z   ↑ cible x,y,z    ↑ focale
```

- Les moments sont exprimés **en fraction de chaque section** (`at(range, 0.28)` = 28 % de la section), car la hauteur des sections change selon l'écran. La trajectoire est recalculée à chaque redimensionnement.
- Entre deux points, l'interpolation utilise une courbe *smoothstep* : la caméra ne change jamais brutalement de vitesse.
- Un **amortissement exponentiel** (indépendant du nombre d'images/seconde) donne la sensation d'une caméra physique avec de l'inertie.
- Sur écran **portrait**, la caméra recule automatiquement (`setAspect`), sauf pour les plans rapprochés de l'habitacle.

### `js/experience/Car.js` — la voiture

1. **Chargement** du fichier FBX avec suivi de progression (affiché par l'écran de chargement).
2. **Mise à l'échelle** (centimètres → mètres), rotation pour que l'avant pointe vers +X, roues posées au sol.
3. **Re-matérialisation** : le fichier ne contient que des noms de matériaux (`carpaint`, `tinted_glass`, `leather`…). Chaque nom est associé à un matériau PBR soigné défini dans `_buildMaterials()`.
4. **Pivots** : les 4 roues et l'aileron sont détachés sur leurs propres pivots pour pouvoir tourner ou disparaître.
5. **Repérage** des phares (halos et projecteurs), des sorties d'échappement (fumée) et des pièces du moteur (vue éclatée).
6. **Fusion de la géométrie** — voir plus bas.

L'API publique (`setPaint`, `setCalipers`, `setWheelStyle`, `setSpoiler`, `setAmbient`, `setLights`) est utilisée par le configurateur et l'intro.

### `js/experience/Engine.js` — la vue éclatée

Reçoit des copies du bloc moteur, du compresseur et de la boîte de vitesses. Chaque pièce a une **direction d'éclatement** ; `setExplode(p)` les écarte proportionnellement au scroll.

### Les autres modules

| Fichier | Rôle |
|---|---|
| `Environment.js` | Éclairage d'environnement HDR, sol réfléchissant, brouillard, lumières d'accent rouge et bleue, lumière qui suit la souris |
| `Particles.js` | 700 particules : poussière en suspension au repos, traînées de vitesse en scène performance et finale |
| `Smoke.js` | Réserve de 48 *sprites* recyclés pour la fumée d'échappement |
| `ui/Loader.js` | Écran de chargement (progression réelle du modèle) et séquence d'intro (phares, titres) |
| `ui/Cursor.js` | Curseur personnalisé, boutons magnétiques, inclinaison 3D des cartes |
| `audio/EngineSound.js` | Synthèse du V8 : deux oscillateurs graves + bruit filtré, régime piloté par le scroll |

---

## Focus : la fusion de géométrie

C'est l'optimisation qui rend le site fluide.

**Le problème.** Le fichier FBX est très fragmenté : une seule pièce comme la carrosserie contient 560 sous-parties, chacune avec son matériau. Three.js envoie au processeur graphique **un ordre de dessin par sous-partie** — environ 2 200 par image, et le double avec les ombres. Résultat : ~13 images/seconde.

**La solution.** Au chargement, `_mergeStaticGeometry()` :

1. parcourt toutes les pièces fixes de la voiture ;
2. découpe chacune selon ses matériaux (`_splitMeshIntoBuckets`) ;
3. applique à chaque morceau sa position définitive dans le monde ;
4. regroupe tous les morceaux qui partagent le même matériau dans **un seul objet**.

Les roues et l'aileron, qui doivent bouger, sont fusionnés séparément sur leur propre pivot.

| | Avant | Après |
|---|---|---|
| Appels de dessin par image | ~4 475 | ~126 |
| Temps par image (Intel Iris Xe) | ~78 ms | ~12 ms |

Comme tous les éléments peints partagent le même matériau, changer la couleur dans le configurateur reste instantané.

---

## Mise en page « collée » (sticky)

Chaque section est bien plus haute que l'écran. Ses contenus utilisent `position: sticky` pour rester visibles pendant que la caméra bouge :

- le **titre** est collé en haut (`top: 0`) ;
- le **panneau** (statistiques, compteur, configurateur…) est collé en bas (`bottom: 5vh`).

Un élément collé en bas ne reste à l'écran que s'il est placé **à la fin** de sa section : les sections concernées sont donc en `display: flex; flex-direction: column` et le panneau reçoit `margin-top: auto`.

---

## Accessibilité

- Structure sémantique : `header`, `nav`, `main`, `section` avec `aria-labelledby`, `figure/figcaption`, `footer`
- Lien d'évitement « Aller au contenu » au clavier
- Le configurateur utilise des `role="radiogroup"` / `role="radio"` avec `aria-checked`
- Le bouton son expose son état avec `aria-pressed`
- Toutes les images de la galerie ont un texte alternatif descriptif
- `prefers-reduced-motion` : animations CSS neutralisées et scroll fluide désactivé

---

## Dépendances externes

Chargées depuis des CDN, versions figées :

| Librairie | Version | Chargement |
|---|---|---|
| three | 0.160.0 | *import map* (`index.html`) |
| gsap + ScrollTrigger | 3.12.5 | `<script>` global |
| @studio-freight/lenis | 1.0.42 | `<script>` global |
| Space Grotesk, Inter | — | Google Fonts |
