# Modèle 3D — Ford Mustang Shelby GT500

[← Retour au README](../../README.md)

## Fichiers

| Fichier | Taille | Rôle |
|---|---|---|
| `shelby-src/source/maya2sketchfab.fbx` | ~22 Mo | Le modèle complet (carrosserie, intérieur, moteur, châssis, roues) |
| `shelby-src/textures/internal_ground_ao_texture.jpeg` | 15 Ko | Texture d'occlusion fournie avec le modèle (non utilisée par le site) |

## Provenance & licence

Modèle téléchargé depuis **[Sketchfab](https://sketchfab.com/)** (export Maya → Sketchfab).

> **À compléter par le propriétaire du dépôt** : nom de l'auteur, lien vers la page Sketchfab du modèle et licence exacte (affichée sur la page de téléchargement). Les modèles gratuits de Sketchfab sont le plus souvent sous licence Creative Commons, qui impose de **créditer l'auteur** — et certaines variantes (NC) interdisent tout usage commercial.
>
> - Auteur : *…*
> - Page du modèle : *…*
> - Licence : *…*

## Structure du modèle

Le fichier contient environ 90 pièces nommées `GT500…`. Celles exploitées par le site :

| Pièce(s) | Utilisation |
|---|---|
| `GT500WheelFtL`, `GT500WheelFtR`, `GT500WheelBkL`, `GT500WheelBkR` | Roues — rotation au scroll, finition au configurateur |
| `GT500Wing` | Aileron — option du configurateur |
| `GT500HeadlightL/R` | Position des halos et projecteurs des phares |
| `GT500ExhaustTipL/R` | Point d'émission de la fumée d'échappement |
| `GT500Engine`, `GT500Supercharger`, `GT500Transmission` | Vue éclatée du moteur |
| `GT500Gauges`, `GT500Screen` | Écrans lumineux de l'habitacle |

Le fichier ne contient aucune couleur ni texture exploitable : seulement des **noms de matériaux**. Le site les remplace par ses propres matériaux PBR :

| Nom dans le fichier | Rendu dans le site |
|---|---|
| `carpaint` | Peinture vernie (couleur du configurateur) |
| `tinted_glass` | Verre fumé |
| `glossblack` | Plastique noir brillant |
| `leather`, `seat` | Cuir de l'habitacle |
| `mirror` | Chrome miroir |
| `plate` | Métal brossé (châssis, échappements) |
| `lambert1` | Jantes |
| `brake` | Étriers et disques |
| `light`, `rearlight` | Phares et feux arrière (lumineux) |
| `tire` | Pneus |

Les détails du chargement et de l'optimisation sont dans [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md#focus--la-fusion-de-géométrie).
