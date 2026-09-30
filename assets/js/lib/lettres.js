// Montants en toutes lettres (orthographe traditionnelle).

const UNITES = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize',
  'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const DIZAINES = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];

// final : le nombre termine l'expression (accord de « vingts » et « cents »)
function sous100(n, final) {
  if (n < 20) return UNITES[n];
  const d = Math.floor(n / 10);
  const u = n % 10;
  if (d === 7) return u === 1 ? 'soixante et onze' : 'soixante-' + UNITES[10 + u];
  if (d === 8) return u === 0 ? (final ? 'quatre-vingts' : 'quatre-vingt') : 'quatre-vingt-' + UNITES[u];
  if (d === 9) return 'quatre-vingt-' + UNITES[10 + u];
  if (u === 0) return DIZAINES[d];
  if (u === 1) return DIZAINES[d] + ' et un';
  return DIZAINES[d] + '-' + UNITES[u];
}

function sous1000(n, final) {
  const c = Math.floor(n / 100);
  const r = n % 100;
  if (c === 0) return sous100(r, final);
  const cent = c === 1 ? 'cent' : UNITES[c] + ' cent' + (r === 0 && final ? 's' : '');
  return r ? cent + ' ' + sous100(r, final) : cent;
}

export function nombreEnLettres(n) {
  n = Math.floor(Math.abs(n));
  if (n === 0) return 'zéro';
  const millions = Math.floor(n / 1e6);
  const milliers = Math.floor((n % 1e6) / 1000);
  const reste = n % 1000;
  const parts = [];
  if (millions) parts.push(sous1000(millions, true) + (millions > 1 ? ' millions' : ' million'));
  if (milliers) parts.push(milliers === 1 ? 'mille' : sous1000(milliers, false) + ' mille');
  if (reste) parts.push(sous1000(reste, true));
  return parts.join(' ');
}

/** 85050 -> "huit cent cinquante euros et cinquante centimes" */
export function montantEnLettres(centimes) {
  const e = Math.floor(Math.abs(centimes) / 100);
  const c = Math.abs(centimes) % 100;
  const rondMillion = e >= 1e6 && e % 1e6 === 0;
  let t = nombreEnLettres(e) + (rondMillion ? " d'euros" : e > 1 ? ' euros' : ' euro');
  if (c) t += ' et ' + nombreEnLettres(c) + (c > 1 ? ' centimes' : ' centime');
  return t;
}
