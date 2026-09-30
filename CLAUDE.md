# CLAUDE.md — Quittance Tranquille (outil)

Site Hugo (extended **0.121.1**, fixé dans le workflow) : générateur gratuit de quittances de loyer. Tout est en **français**.
Site de présentation séparé : `../vitrine`. Funnel vers l'outil payant « État des lieux Offline ».

## Principes
- **Aucune donnée envoyée sur un serveur** : les infos du bail vivent dans le fragment d'URL (`#…`) des rappels d'agenda. Pas de compte, pas de cookie, pas de traceur, aucune ressource externe (jsPDF est servi par le site, `static/js/vendor/`, chargé à la demande).
- La quittance n'est jamais envoyée automatiquement : le bailleur la génère quand il a reçu le loyer.
- Paiement partiel = **reçu**, pas quittance. Loyer et charges toujours séparés. Pas de dépôt de garantie.
- Ne jamais nommer GitHub sur le site ; écrire « service d'hébergement ».
- Rester prudent sur le juridique (renvoi à service-public.fr, modèle à faire relire par un juriste).

## Code
- `assets/js/lib/` : `dates.js` (échéances, 29-31, période par défaut), `ics.js` (RRULE, VALARM, pliage 75 octets), `lien.js` (fragment : deflate-raw + base64url, préfixe `z`, repli `j`), `document.js` (modèle, aperçu HTML, PDF jsPDF), `lettres.js` (montant en lettres), `format.js`.
- `assets/js/configurateur.js` (accueil) et `assets/js/generer.js` (page `/generer/`), assemblés par `js.Build`.
- Format des données du bail (clés courtes) : `b{n,a}` bailleur, `l{n,e}` locataire, `a` logement, `t` v/m/c, `y`/`c` loyer et charges en centimes, `cf` forfait, `j` jour, `f` dernier/28, `r` m/t/a, `fa` ville, `m0` premier mois AAAA-MM. **Ne pas casser la compatibilité** : les liens déjà dans les agendas doivent continuer à marcher.
- Tests : `node --test tests/`.
- Guides SEO : `content/guides/*.md` ; FAQ : `data/faq.yaml`.

## Commandes
- `hugo server` puis http://localhost:1313/quittance-tranquille/ · `hugo --gc --minify`
- Déploiement : push sur `main` (workflow `.github/workflows/hugo.yml`, GitHub Pages).
- Changer d'URL de base casse les liens des agendas existants : prévoir une redirection.
