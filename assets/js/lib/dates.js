// Calculs de dates en jours civils (chaînes ISO "AAAA-MM-JJ", mois de 0 à 11), sans fuseau horaire.

import { MOIS, dateLongue } from './format.js';

export const RYTHMES = { m: 1, t: 3, a: 12 };

export function joursDansMois(a, m) {
  return new Date(Date.UTC(a, m + 1, 0)).getUTCDate();
}

export function iso(a, m, j) {
  return `${a}-${String(m + 1).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
}

export function aujourdhui(d = new Date()) {
  return iso(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Ajoute n mois à (a, m) -> [a, m] */
export function ajouterMois(a, m, n) {
  const t = a * 12 + m + n;
  return [Math.floor(t / 12), ((t % 12) + 12) % 12];
}

/** Jour d'échéance effectif du mois. fin : "dernier" (dernier jour du mois) ou "28" (plafonné au 28) pour les jours 29 à 31. */
export function jourEcheance(a, m, jour, fin) {
  if (jour <= 28) return jour;
  if (fin === '28') return 28;
  return joursDansMois(a, m);
}

export function echeance(a, m, jour, fin) {
  return iso(a, m, jourEcheance(a, m, jour, fin));
}

/** Écart en jours entre deux dates ISO (b - a) */
export function ecartJours(a, b) {
  const t = (s) => { const [y, mo, d] = s.split('-').map(Number); return Date.UTC(y, mo - 1, d); };
  return Math.round((t(b) - t(a)) / 86400000);
}

export function ajouterJours(s, n) {
  const [y, mo, d] = s.split('-').map(Number);
  const x = new Date(Date.UTC(y, mo - 1, d + n));
  return iso(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
}

/** Premier mois (à partir du mois de `jour`) dont l'échéance tombe aujourd'hui ou plus tard -> [a, m] */
export function premiereEcheance(bail, jour) {
  let [a, m] = jour.split('-').map(Number);
  m -= 1;
  for (let k = 0; k < 2; k++) {
    const [aa, mm] = ajouterMois(a, m, k);
    if (echeance(aa, mm, bail.j, bail.f) >= jour) return [aa, mm];
  }
  return ajouterMois(a, m, 1);
}

/**
 * Période proposée par défaut à l'ouverture du lien : l'échéance la plus proche d'aujourd'hui
 * (en cas d'égalité, la plus ancienne). Ex. loyer du 5, clic le 8 -> mois en cours ; clic le 29 pour un loyer du 1er -> mois suivant.
 */
export function periodeParDefaut(bail, jour) {
  const n = RYTHMES[bail.r] || 1;
  let [a, m] = jour.split('-').map(Number);
  m -= 1;
  // Mois de départ connu (m0 = "AAAA-MM") : on reste sur la grille trimestrielle / annuelle
  let ancre = null;
  if (bail.m0 && /^\d{4}-\d{2}$/.test(bail.m0)) {
    const [a0, m0] = bail.m0.split('-').map(Number);
    ancre = a0 * 12 + m0 - 1;
  }
  let meilleur = null;
  for (let k = -n - 1; k <= n + 1; k++) {
    const [aa, mm] = ajouterMois(a, m, k);
    if (ancre !== null && n > 1 && ((((aa * 12 + mm) - ancre) % n) + n) % n !== 0) continue;
    const e = echeance(aa, mm, bail.j, bail.f);
    const d = Math.abs(ecartJours(jour, e));
    if (!meilleur || d < meilleur.d || (d === meilleur.d && e < meilleur.e)) meilleur = { a: aa, m: mm, e, d };
  }
  return [meilleur.a, meilleur.m];
}

/** Période couverte par une échéance : du 1er du mois au dernier jour du dernier mois couvert */
export function periode(a, m, rythme) {
  const n = RYTHMES[rythme] || 1;
  const [af, mf] = ajouterMois(a, m, n - 1);
  const debut = iso(a, m, 1);
  const fin = iso(af, mf, joursDansMois(af, mf));
  let libelle;
  if (n === 1) libelle = `${MOIS[m]} ${a}`;
  else libelle = a === af ? `${MOIS[m]} à ${MOIS[mf]} ${a}` : `${MOIS[m]} ${a} à ${MOIS[mf]} ${af}`;
  return { debut, fin, libelle, texte: `du ${dateLongue(debut)} au ${dateLongue(fin)}` };
}
