# Guide de modification

Comment changer le site soi-même, du plus simple au plus avancé. Chaque recette indique **le fichier à ouvrir** et **quoi modifier**.

[← Retour au README](../README.md)

---

## Avant de commencer

1. Ouvrir le dossier du projet dans **VS Code** : *Fichier → Ouvrir le dossier…*
2. Lancer le site en local : terminal de VS Code (*Terminal → Nouveau terminal*), puis :
   ```bash
   python serve.py
   ```
3. Ouvrir **http://localhost:8137** dans le navigateur.
4. Après chaque modification : enregistrer (**Ctrl + S**) puis recharger la page (**Ctrl + F5** pour être sûr d'avoir la nouvelle version).

> 💡 Pour retrouver un texte rapidement : **Ctrl + Maj + F** dans VS Code cherche dans tous les fichiers.

---

## Niveau 1 — Textes et chiffres

### Changer un titre ou un paragraphe

📄 `index.html` — chaque scène est une `<section>` avec un commentaire qui la nomme :

```html
<!-- ══════════════ SCÈNE 3 — MOTEUR ══════════════ -->
<h2 class="section__title" id="engine-title">V8 5.2<br /><em>Predator.</em></h2>
```

- `<br />` = retour à la ligne
- le texte entre `<em>` et `</em>` s'affiche **en contour** (lettres creuses)

### Changer un compteur animé

📄 `index.html`, scène moteur. Le chiffre affiché est dans `data-counter`, le nombre de décimales dans `data-decimals` :

```html
<span data-counter="760" data-decimals="0">0</span>
```

### Changer la vitesse maximale du compteur

📄 `js/main.js`, chercher `* 290` :

```js
const kmh = Math.round(gsap.parseEase('power2.inOut')(p) * 290);
```

---

## Niveau 2 — Couleurs et configurateur

### Changer les couleurs du site

📄 `css/main.css`, tout en haut, bloc `:root`. Toutes les couleurs du site viennent de là :

```css
--c-bg:   #050505;   /* fond */
--c-red:  #e01e2b;   /* rouge Mustang : liens, accents, boutons */
--c-text: #f2f0ea;   /* texte principal */
```

Changer `--c-red` en `#1d55d4` rend tout le site bleu d'un coup.

### Ajouter une teinte de carrosserie

📄 `js/config.js`, ajouter une ligne dans `PAINTS` :

```js
export const PAINTS = [
  { id: 'race-red', name: 'Rouge Race', hex: '#9e0d18', price: 0 },
  // …
  { id: 'vert', name: 'Vert Eruption', hex: '#1f5a2c', price: 1500 },  // ← nouvelle
];
```

La pastille apparaît automatiquement dans le configurateur. Même principe pour les étriers (`CALIPERS`).

### Changer les prix

📄 `js/config.js` :

```js
export const SPOILER_PRICE = 1200;   // prix de l'aileron
export const BASE_PRICE = 94900;     // prix de base
```

Le prix de chaque option est dans son champ `price`.

### Changer la couleur de départ de la voiture

📄 `js/experience/Car.js`, méthode `_buildMaterials()`, matériau `paint` :

```js
paint: new THREE.MeshPhysicalMaterial({
  color: 0x9e0d18,   // ← couleur (même format que #9e0d18, avec 0x devant)
```

Penser à changer aussi la pastille active dans `js/main.js` (`'race-red'` à la fin de l'appel `buildSwatches('config-paint', …)`).

---

## Niveau 3 — La 3D

### Modifier un mouvement de caméra

📄 `js/experience/CameraDirector.js`, méthode `build()`. Chaque ligne `kf(...)` est une position de caméra :

```js
kf(at(d, 0.28),  2.7, 0.85, 4.9,   1.45, 0.45, 0.8,  46);
//   │            └─ position ─┘    └── cible ──┘    └ focale
//   └ moment : 28 % de la section « design »
```

Repères pour les coordonnées (en mètres, la voiture est au centre) :

| Axe | Sens |
|---|---|
| **x** | positif = devant la voiture, négatif = derrière |
| **y** | hauteur (0 = sol, la voiture fait ~1,4 m) |
| **z** | positif = côté passager, négatif = côté conducteur |

- **Focale** : petit nombre (30) = effet zoom, grand nombre (60) = grand angle.
- Astuce : modifier une seule valeur à la fois et recharger pour voir l'effet.

### Régler l'éclairage

📄 `js/experience/Environment.js` :

- `key` — lumière principale blanche (intensité `2.4`)
- `rimRed` — contre-jour rouge derrière la voiture
- `rimCool` — accent bleuté à l'avant
- `scene.fog` — densité du brouillard (`0.038` ; plus grand = plus de brouillard)

📄 `js/experience/Experience.js` — exposition générale : `toneMappingExposure = 1.15`, et intensité du bloom (halo lumineux) : deuxième paramètre de `UnrealBloomPass` (`0.3`).

### Changer la vitesse du scroll

📄 `js/main.js`, création de Lenis :

```js
lenis = new Lenis({ lerp: 0.08, wheelMultiplier: 0.9 });
```

- `lerp` plus petit (0.05) = plus fluide et « lourd », plus grand (0.15) = plus réactif
- `wheelMultiplier` plus grand = on avance plus vite à chaque cran de molette

### Allonger ou raccourcir une scène

📄 `css/main.css`, chaque section a une hauteur, par exemple :

```css
.design { min-height: 340vh; }   /* 340 % de la hauteur de l'écran */
```

Plus la valeur est grande, plus la scène dure longtemps au scroll. La caméra s'adapte toute seule.

---

## Niveau 4 — Remplacer la voiture

1. Déposer le nouveau modèle dans `assets/models/`.
2. 📄 `js/experience/Car.js`, modifier le chemin :
   ```js
   const MODEL_URL = 'assets/models/…/mon-modele.fbx';
   ```
   Pour un fichier `.glb` / `.gltf`, remplacer `FBXLoader` par `GLTFLoader` (`three/addons/loaders/GLTFLoader.js`) et utiliser `gltf.scene` comme racine.
3. Adapter dans `Car.js` :
   - `matMap` : les noms de matériaux du nouveau modèle ;
   - les noms des roues (`'GT500WheelFtL'`…), de l'aileron (`'GT500Wing'`), des phares et des échappements ;
   - `ENGINE_PARTS` : les pièces du moteur pour la vue éclatée ;
   - l'échelle `root.scale.setScalar(0.01)` si le modèle n'est pas en centimètres.

> Pour connaître les noms des pièces d'un modèle : ouvrir la console du navigateur (**F12**) et taper
> `__mustang.car.group` puis explorer l'arborescence.

---

## Mettre en ligne une modification

Le site est publié avec **GitHub Pages** : il suffit d'envoyer les modifications sur GitHub.

```bash
git add .
git commit -m "Description de la modification"
git push
```

Le site en ligne se met à jour en une à deux minutes : https://pouzerguesantoine-design.github.io/mustang/

---

## En cas de problème

| Symptôme | Solution |
|---|---|
| Page noire, rien ne s'affiche | Vérifier que le site est ouvert via `http://localhost:8137` et non en double-cliquant le fichier |
| Les modifications n'apparaissent pas | **Ctrl + F5** pour forcer le rechargement |
| La voiture n'apparaît pas | Ouvrir la console (**F12**) et lire le message d'erreur en rouge |
| Le site est lent | Normal sur les vieux ordinateurs : il réduit sa qualité automatiquement au bout de quelques secondes |
| `python` n'est pas reconnu | Installer Python depuis python.org, ou utiliser l'extension Live Server de VS Code |
