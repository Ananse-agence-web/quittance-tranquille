// Page d'accueil : configurateur du bail, aperçu, téléchargement de l'agenda (.ics).

import { encoder, decoder } from './lib/lien.js';
import { genererIcs } from './lib/ics.js';
import { aujourdhui, periodeParDefaut, premiereEcheance } from './lib/dates.js';
import { champMontant, euros, lireMontant, majuscule, slugNom } from './lib/format.js';
import { modele, rendreHtml } from './lib/document.js';

const form = document.getElementById('config');
const $ = (id) => document.getElementById(id);
const val = (n) => (form.elements[n]?.value ?? '').trim();
const statut = $('statut');
const BROUILLON = 'qt-brouillon';

function lireBail() {
  const j = Number(val('j')) || 1;
  const jour = aujourdhui();
  const bail = {
    v: 1,
    b: { n: val('b_n'), a: val('b_a') },
    l: { n: val('l_n'), e: val('l_e') },
    a: val('a'),
    t: form.elements.t.value,
    y: lireMontant(val('y')),
    c: val('c') ? lireMontant(val('c')) : 0,
    cf: $('cf').checked ? 1 : 0,
    j,
    f: j > 28 ? form.elements.f.value : '',
    r: val('r') || 'm',
    fa: val('fa'),
  };
  const [a, m] = premiereEcheance(bail, jour);
  bail.m0 = `${a}-${String(m + 1).padStart(2, '0')}`;
  return bail;
}

function remplir(b) {
  const set = (n, v) => { if (form.elements[n] && v !== undefined && v !== null) form.elements[n].value = v; };
  set('b_n', b.b?.n); set('b_a', b.b?.a); set('l_n', b.l?.n); set('l_e', b.l?.e); set('a', b.a); set('fa', b.fa);
  if (Number.isFinite(b.y)) set('y', champMontant(b.y));
  if (Number.isFinite(b.c)) set('c', champMontant(b.c));
  if (b.j) set('j', String(b.j));
  if (b.r) set('r', b.r);
  if (b.t) form.querySelector(`input[name=t][value="${b.t}"]`)?.click();
  if (b.f) form.querySelector(`input[name=f][value="${b.f}"]`)?.click();
  $('cf').checked = !!b.cf;
}

function options() {
  return {
    heure: val('heure') || '09:00',
    rappels: [...form.querySelectorAll('input[name=rappel]:checked')].map((i) => Number(i.value)),
    duree: Number(val('duree')) || 12,
    verif: $('verif_on').checked ? Number($('verif').value) : 0,
    irl: $('irl_on').checked ? $('irl').value : '',
  };
}

// ---------- Validation ----------
const REQUIS = [
  ['b_n', 'Indiquez le nom du bailleur.'],
  ['l_n', 'Indiquez le nom du locataire.'],
  ['b_a', "Indiquez l'adresse du bailleur."],
  ['a', "Indiquez l'adresse du logement."],
];

function marquer(id, message) {
  const champ = $(id).closest('.champ');
  champ.classList.toggle('invalide', !!message);
  champ.querySelector('.erreur')?.remove();
  $(id).removeAttribute('aria-invalid');
  if (message) {
    const p = document.createElement('p');
    p.className = 'erreur';
    p.id = `err-${id}`;
    p.textContent = message;
    champ.appendChild(p);
    $(id).setAttribute('aria-invalid', 'true');
    $(id).setAttribute('aria-describedby', p.id);
  }
}

function valider() {
  let premier = null;
  for (const [id, msg] of REQUIS) {
    const ko = !val(id);
    marquer(id, ko ? msg : '');
    if (ko && !premier) premier = id;
  }
  const y = lireMontant(val('y'));
  const koY = !(y > 0);
  marquer('y', koY ? 'Indiquez un loyer valide, par exemple 700 ou 700,50.' : '');
  if (koY && !premier) premier = 'y';
  const koC = val('c') !== '' && Number.isNaN(lireMontant(val('c')));
  marquer('c', koC ? 'Montant de charges invalide.' : '');
  if (koC && !premier) premier = 'c';
  if (premier) {
    $(premier).focus();
    $(premier).scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  return !premier;
}

// ---------- Aperçu ----------
function majApercu() {
  const bail = lireBail();
  const jour = aujourdhui();
  const [a, m] = periodeParDefaut(bail, jour);
  const d = modele({ ...bail, y: Number.isFinite(bail.y) ? bail.y : 0, c: Number.isFinite(bail.c) ? bail.c : 0 },
    { a, m, paiement: jour, emission: jour });
  $('apercu').innerHTML = rendreHtml(d);
  $('apercu-mois').textContent = majuscule(d.periode.libelle);
  $('total').textContent = euros((Number.isFinite(bail.y) ? bail.y : 0) + (Number.isFinite(bail.c) ? bail.c : 0));
  $('bloc-fin').hidden = bail.j <= 28;
  try { sessionStorage.setItem(BROUILLON, JSON.stringify(bail)); } catch { /* stockage indisponible */ }
}

async function lienMensuel(bail) {
  return form.dataset.generer + '#' + (await encoder(bail));
}

function telecharger(nom, contenu, type) {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nom });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (!valider()) return;
  const bail = lireBail();
  const url = await lienMensuel(bail);
  const ics = genererIcs(bail, options(), url, new Date(), form.dataset.guideIrl);
  telecharger(`agenda-quittances-${slugNom(bail.l.n)}.ics`, ics, 'text/calendar;charset=utf-8');
  statut.textContent = `✓ Agenda téléchargé. Ouvrez le fichier pour l'ajouter à votre calendrier (lien de ${url.length} caractères).`;
});

$('ouvrir').addEventListener('click', async () => {
  if (!valider()) return;
  location.href = await lienMensuel(lireBail());
});

$('copier').addEventListener('click', async () => {
  if (!valider()) return;
  const url = await lienMensuel(lireBail());
  try {
    await navigator.clipboard.writeText(url);
    statut.textContent = '✓ Lien copié. Gardez-le pour vous : il contient les informations du bail.';
  } catch {
    prompt('Copiez ce lien :', url);
  }
});

form.addEventListener('input', (ev) => {
  const champ = ev.target.closest('.champ');
  if (champ?.classList.contains('invalide')) marquer(ev.target.id, '');
  majApercu();
});
form.addEventListener('change', majApercu);
$('irl').addEventListener('input', () => { $('irl_on').checked = !!$('irl').value; });
$('verif').addEventListener('change', () => { $('verif_on').checked = true; });

// ---------- Démarrage : lien « modifier » (#...) ou brouillon de la session ----------
(async () => {
  let bail = location.hash.length > 2 ? await decoder(location.hash) : null;
  if (bail) {
    history.replaceState(null, '', location.pathname + '#outil');
    document.getElementById('outil').scrollIntoView();
    statut.textContent = 'Informations du bail reprises depuis votre lien. Modifiez-les puis retéléchargez l\'agenda.';
  } else {
    try { bail = JSON.parse(sessionStorage.getItem(BROUILLON) || 'null'); } catch { bail = null; }
  }
  if (bail) remplir(bail);
  majApercu();
})();
