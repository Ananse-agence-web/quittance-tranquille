// Page ouverte depuis le lien de l'agenda : pré-remplissage, calcul de la période, PDF, envoi.

import { decoder, encoder } from './lib/lien.js';
import { RYTHMES, ajouterMois, aujourdhui, echeance, periodeParDefaut } from './lib/dates.js';
import { champMontant, dateLongue, euros, lireMontant, majuscule } from './lib/format.js';
import { chargerJsPdf, genererPdf, modele, rendreHtml } from './lib/document.js';

const $ = (id) => document.getElementById(id);
const racine = $('gen');
const SIGNATURE = 'qt-signature';

let bail = null;
let periodeCourante = [0, 0];
let paiementManuel = false;
let messageManuel = false;
let signature = '';

const partiel = () => document.querySelector('input[name=mode]:checked').value === 'r';
const montant = (id, defaut) => { const v = lireMontant($(id).value); return Number.isFinite(v) ? v : defaut; };

function bailEdite() {
  return {
    ...bail,
    b: { n: $('g_bn').value.trim(), a: $('g_ba').value.trim() },
    l: { ...bail.l, n: $('g_ln').value.trim(), e: $('m_a').value.trim() },
    a: $('g_a').value.trim(),
    fa: $('g_fa').value.trim(),
    y: montant('g_y', bail.y || 0),
    c: montant('g_c', bail.c || 0),
  };
}

function etat() {
  const [a, m] = periodeCourante;
  const b = bailEdite();
  return {
    a, m,
    y: b.y, c: b.c,
    partiel: partiel(),
    verse: montant('g_v', 0),
    paiement: $('g_p').value || '',
    emission: $('g_e').value || aujourdhui(),
    signature,
  };
}

function document_() {
  return modele(bailEdite(), etat());
}

function majPaiementParDefaut() {
  if (paiementManuel) return;
  const [a, m] = periodeCourante;
  const e = echeance(a, m, bail.j || 1, bail.f);
  const jour = aujourdhui();
  $('g_p').value = e < jour ? e : jour;
}

function majMessage(d) {
  if (messageManuel) return;
  const lieu = d.logement.adresse.split('\n')[0];
  $('m_o').value = `${d.titre} — ${majuscule(d.periode.libelle)}`;
  const corps = d.partiel
    ? `Bonjour,\n\nVeuillez trouver ci-joint le reçu de la somme de ${euros(d.verse)} que j'ai reçue${$('g_p').value ? ` le ${dateLongue($('g_p').value)}` : ''}, pour le loyer et les charges de la période : ${d.periode.libelle} (logement situé ${lieu}).\n\nIl reste ${euros(d.reste)} à régler pour cette période.\n\nBien cordialement,\n${d.bailleur.nom}`
    : `Bonjour,\n\nVeuillez trouver ci-joint la quittance de loyer pour la période : ${d.periode.libelle} (logement situé ${lieu}).\n\nJe vous remercie pour votre règlement.\n\nBien cordialement,\n${d.bailleur.nom}`;
  $('m_t').value = corps.replace(/ /g, ' ');
}

function maj() {
  const d = document_();
  $('apercu').innerHTML = rendreHtml(d);
  $('apercu-mois').textContent = majuscule(d.periode.libelle);
  $('periode-texte').textContent = `Période ${d.periode.texte}`;
  $('g_total').textContent = euros(d.total);
  $('bloc-verse').hidden = !d.partiel;
  $('reste').textContent = d.partiel ? `Reste dû : ${euros(d.reste)}` : '';
  $('titre').textContent = `${d.titre} — ${majuscule(d.periode.libelle)}`;
  $('pdf-texte').textContent = d.partiel ? 'Télécharger le reçu (PDF)' : 'Télécharger la quittance (PDF)';
  $('aide-mode').textContent = d.partiel
    ? "Paiement incomplet : un reçu indique la somme versée et le reste dû. Il ne vaut pas quittance."
    : 'La quittance atteste du paiement intégral du loyer et des charges.';
  $('rappel-q').hidden = d.partiel;
  majMessage(d);
}

function allerA(a, m) {
  periodeCourante = [a, m];
  $('mois').value = `${a}-${String(m + 1).padStart(2, '0')}`;
  majPaiementParDefaut();
  maj();
}

// ---------- PDF ----------
async function fabriquerPdf() {
  const d = document_();
  if (d.partiel && !(d.verse > 0)) throw new Error('Indiquez la somme effectivement reçue.');
  const blob = await genererPdf(d, racine.dataset.jspdf);
  return { blob, nom: d.nomFichier };
}

$('pdf').addEventListener('click', async () => {
  const statut = $('statut');
  try {
    statut.textContent = 'Préparation du PDF…';
    const { blob, nom } = await fabriquerPdf();
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: nom });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    statut.textContent = `✓ ${nom} téléchargé. Vous pouvez maintenant l'envoyer au locataire.`;
  } catch (e) {
    statut.textContent = e.message;
  }
});

$('partager').addEventListener('click', async () => {
  const statut = $('statut');
  try {
    const { blob, nom } = await fabriquerPdf();
    const fichier = new File([blob], nom, { type: 'application/pdf' });
    await navigator.share({ files: [fichier], title: $('m_o').value, text: $('m_t').value });
    statut.textContent = '✓ Document partagé.';
  } catch (e) {
    if (e.name !== 'AbortError') statut.textContent = e.message || 'Partage impossible : téléchargez le PDF.';
  }
});

$('mail').addEventListener('click', () => {
  const q = new URLSearchParams({ subject: $('m_o').value, body: $('m_t').value }).toString().replace(/\+/g, '%20');
  location.href = `mailto:${encodeURIComponent($('m_a').value.trim())}?${q}`;
});

// ---------- Signature ----------
function initSignature() {
  const pad = $('pad');
  const ctx = pad.getContext('2d');
  const dimensionner = () => {
    const r = pad.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    pad.width = r.width * dpr;
    pad.height = r.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#14202e';
    if (signature) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, r.width, r.height);
      img.src = signature;
    }
  };
  $('bloc-signature').addEventListener('toggle', dimensionner);
  window.addEventListener('resize', dimensionner);
  let trace = false;
  let dessine = false;
  const pos = (e) => { const r = pad.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  pad.addEventListener('pointerdown', (e) => {
    trace = true;
    pad.setPointerCapture(e.pointerId);
    ctx.beginPath();
    ctx.moveTo(...pos(e));
  });
  pad.addEventListener('pointermove', (e) => {
    if (!trace) return;
    ctx.lineTo(...pos(e));
    ctx.stroke();
    dessine = true;
  });
  const fin = () => {
    if (!trace) return;
    trace = false;
    if (dessine) {
      signature = pad.toDataURL('image/png');
      memoriser();
      maj();
    }
  };
  pad.addEventListener('pointerup', fin);
  pad.addEventListener('pointercancel', fin);
  $('effacer').addEventListener('click', () => {
    ctx.clearRect(0, 0, pad.width, pad.height);
    signature = '';
    dessine = false;
    memoriser();
    maj();
  });
  $('memo').addEventListener('change', memoriser);
}

function memoriser() {
  try {
    if ($('memo').checked && signature) localStorage.setItem(SIGNATURE, signature);
    else localStorage.removeItem(SIGNATURE);
  } catch { /* stockage indisponible */ }
}

// ---------- Démarrage ----------
(async () => {
  bail = await decoder(location.hash);
  if (!bail || !bail.b || !bail.l) {
    $('vide').hidden = false;
    return;
  }
  $('plein').hidden = false;
  bail.j = Math.min(31, Math.max(1, Number(bail.j) || 1));
  $('g_bn').value = bail.b.n || '';
  $('g_ba').value = bail.b.a || '';
  $('g_ln').value = bail.l.n || '';
  $('g_a').value = bail.a || '';
  $('g_fa').value = bail.fa || '';
  $('m_a').value = bail.l.e || '';
  $('g_y').value = champMontant(bail.y || 0);
  $('g_c').value = champMontant(bail.c || 0);
  $('g_e').value = aujourdhui();
  $('sous-titre').textContent = `${bail.l.n} · ${(bail.a || '').split('\n')[0]}`;
  document.title = `Quittance — ${bail.l.n}`;
  try { signature = localStorage.getItem(SIGNATURE) || ''; } catch { signature = ''; }
  $('memo').checked = !!signature;
  $('lien-modifier').href = racine.dataset.accueil + location.hash;

  const [a, m] = periodeParDefaut(bail, aujourdhui());
  allerA(a, m);

  const pas = RYTHMES[bail.r] || 1;
  $('prec').addEventListener('click', () => allerA(...ajouterMois(...periodeCourante, -pas)));
  $('suiv').addEventListener('click', () => allerA(...ajouterMois(...periodeCourante, pas)));
  $('mois').addEventListener('change', () => {
    const [aa, mm] = $('mois').value.split('-').map(Number);
    if (aa && mm) allerA(aa, mm - 1);
  });
  $('g_p').addEventListener('input', () => { paiementManuel = true; });
  for (const id of ['m_o', 'm_t']) $(id).addEventListener('input', () => { messageManuel = true; });
  document.querySelector('#plein').addEventListener('input', (e) => { if (!['m_o', 'm_t', 'm_a'].includes(e.target.id)) maj(); });
  document.querySelector('#plein').addEventListener('change', (e) => { if (e.target.name === 'mode') { if (partiel() && !$('g_v').value) $('g_v').value = ''; maj(); } });

  // Lien « mettre à jour l'agenda » : reflète les corrections faites ici
  $('lien-modifier').addEventListener('click', async (e) => {
    e.preventDefault();
    const b = bailEdite();
    location.href = racine.dataset.accueil + '#' + (await encoder(b));
  });

  initSignature();

  // Partage de fichier (surtout sur mobile) : seulement si le navigateur le permet
  try {
    const test = new File(['x'], 'test.pdf', { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [test] })) $('partager').hidden = false;
  } catch { /* pas de partage de fichier */ }

  // Précharge le module PDF (fichier du site) pour un partage immédiat au clic
  (window.requestIdleCallback || setTimeout)(() => chargerJsPdf(racine.dataset.jspdf).catch(() => {}));
})();
