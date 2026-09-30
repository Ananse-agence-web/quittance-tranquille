// Formats français : montants (en centimes), dates, noms de fichiers.

export const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const NBSP = ' ';

/** 85000 -> "850,00 €" */
export function euros(centimes) {
  const n = Math.round(Number(centimes) || 0);
  const signe = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const ent = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${signe}${ent},${String(abs % 100).padStart(2, '0')}${NBSP}€`;
}

/** "850,5" | "850.50" | "1 200" -> centimes (entier) ; NaN si invalide */
export function lireMontant(texte) {
  if (typeof texte === 'number') return Math.round(texte * 100);
  const t = String(texte ?? '').replace(/[\s  €]/g, '').replace(',', '.');
  if (!t) return NaN;
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return NaN;
  return Math.round(parseFloat(t) * 100);
}

/** centimes -> texte de champ "850,00" */
export function champMontant(centimes) {
  if (!Number.isFinite(centimes)) return '';
  return (centimes / 100).toFixed(2).replace('.', ',');
}

/** "2026-10-05" -> "5 octobre 2026" (et "1er") */
export function dateLongue(iso) {
  const [a, m, j] = iso.split('-').map(Number);
  return `${j === 1 ? '1er' : j} ${MOIS[m - 1]} ${a}`;
}

/** "2026-10-05" -> "05/10/2026" */
export function dateCourte(iso) {
  const [a, m, j] = iso.split('-');
  return `${j}/${m}/${a}`;
}

/** (2026, 9) -> "octobre 2026" (mois de 0 à 11) */
export function moisAnnee(a, m) {
  return `${MOIS[m]} ${a}`;
}

export function majuscule(t) {
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

/** "Mme Camille Dupont-Léger" -> "dupont-leger" (dernier mot, sans accent) */
export function slugNom(nom) {
  const mots = String(nom || '').split(/[,&]/)[0].trim().split(/\s+/);
  const dernier = mots[mots.length - 1] || 'locataire';
  return dernier.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9-]+/g, '') || 'locataire';
}

export function echapperHtml(t) {
  return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
