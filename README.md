# Quittance Tranquille

Générateur gratuit de quittances de loyer, 100 % dans le navigateur.

1. Configurer le bail une fois.
2. Télécharger l'agenda (.ics) avec les rappels.
3. Chaque mois, cliquer sur le lien du rappel : la quittance (ou le reçu de paiement partiel) est générée en PDF.

Aucune donnée n'est envoyée sur un serveur : les informations du bail sont dans le fragment (`#…`) du lien.

```bash
hugo server          # http://localhost:1313/quittance-tranquille/
node --test tests/   # tests des calculs (dates, agenda, lien, montants en lettres)
```

À compléter avant diffusion large : `content/mentions-legales.md`, `email` dans `hugo.toml`. Faire relire le modèle de quittance par un juriste.
