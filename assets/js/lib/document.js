// Contenu de la quittance (ou du reçu), rendu HTML (aperçu) et PDF (jsPDF, chargé à la demande depuis le site).

import { dateLongue, echapperHtml, euros, majuscule, slugNom } from './format.js';
import { montantEnLettres } from './lettres.js';
import { periode } from './dates.js';

const TYPES = { v: 'logement vide', m: 'logement meublé', c: 'colocation' };

/**
 * @param bail  données du bail
 * @param e     { a, m, paiement, emission, partiel, verse, y, c, signature }
 */
export function modele(bail, e) {
  const p = periode(e.a, e.m, bail.r);
  const y = Number.isFinite(e.y) ? e.y : bail.y || 0;
  const c = Number.isFinite(e.c) ? e.c : bail.c || 0;
  const total = y + c;
  const partiel = !!e.partiel;
  const verse = partiel ? Math.max(0, Math.min(e.verse || 0, total)) : total;
  const bailleur = (bail.b?.n || '').trim() || '[Nom du bailleur]';
  const locataire = (bail.l?.n || '').trim() || '[Nom du locataire]';
  const coloc = bail.t === 'c';
  const lignes = [
    ['Loyer hors charges', y],
    [bail.cf ? 'Forfait de charges' : 'Provision pour charges', c],
  ];
  const corps = partiel
    ? `Je soussigné(e) ${bailleur}, bailleur du logement désigné ci-dessus, déclare avoir reçu de ${locataire} la somme de ${euros(verse)} (${montantEnLettres(verse)}), à titre de paiement partiel du loyer et des charges de la période de location ${p.texte}.`
    : `Je soussigné(e) ${bailleur}, bailleur du logement désigné ci-dessus, déclare avoir reçu de ${locataire} la somme de ${euros(total)} (${montantEnLettres(total)}), au titre du paiement du loyer et des charges pour la période de location ${p.texte}, et lui en donne quittance, sous réserve de tous mes droits.`;
  const mentions = partiel
    ? ["Ce reçu atteste d'un paiement partiel et ne vaut pas quittance. Une quittance sera délivrée après le paiement intégral du loyer et des charges de la période.",
      'Reçu délivré gratuitement.']
    : ['Quittance délivrée gratuitement (article 21 de la loi n° 89-462 du 6 juillet 1989).',
      'Cette quittance annule tous les reçus qui auraient pu être établis précédemment pour la même période.'];
  const lieu = (bail.fa || '').trim();
  return {
    partiel,
    titre: partiel ? 'Reçu de paiement partiel' : 'Quittance de loyer',
    periode: p,
    bailleur: { nom: bailleur, adresse: (bail.b?.a || '').trim() },
    locataire: { nom: locataire, libelle: coloc ? 'Colocataire(s)' : 'Locataire' },
    logement: { adresse: (bail.a || '').trim() || '[Adresse du logement]', type: TYPES[bail.t] || TYPES.v },
    lignes,
    total,
    verse,
    reste: total - verse,
    corps,
    paiement: e.paiement ? `${partiel ? 'Somme reçue' : 'Paiement reçu'} le ${dateLongue(e.paiement)}` : '',
    faitLe: `Fait${lieu ? ` à ${lieu}` : ''}, le ${dateLongue(e.emission)}`,
    signature: e.signature || '',
    mentions,
    nomFichier: `${partiel ? 'recu' : 'quittance'}-${p.debut.slice(0, 7)}-${slugNom(bail.l?.n)}.pdf`,
  };
}

const h = echapperHtml;
const br = (t) => h(t).replace(/\n/g, '<br>');

export function rendreHtml(d) {
  const lignes = d.lignes.map(([l, v]) => `<tr><td>${h(l)}</td><td>${h(euros(v))}</td></tr>`).join('');
  const bas = d.partiel
    ? `<tr class="total"><td>Total dû pour la période</td><td>${h(euros(d.total))}</td></tr>
       <tr class="verse"><td>Somme versée</td><td>${h(euros(d.verse))}</td></tr>
       <tr class="reste"><td>Reste dû</td><td>${h(euros(d.reste))}</td></tr>`
    : `<tr class="total"><td>Total payé</td><td>${h(euros(d.total))}</td></tr>`;
  return `
  <div class="doc-tete">
    <div><div class="doc-titre">${h(d.titre)}</div><div class="doc-periode">${h(majuscule(d.periode.libelle))}</div></div>
    <div class="doc-du">Période ${h(d.periode.texte)}</div>
  </div>
  <div class="doc-parties">
    <div><div class="doc-etiquette">Bailleur</div><strong>${h(d.bailleur.nom)}</strong>${d.bailleur.adresse ? `<br>${br(d.bailleur.adresse)}` : ''}</div>
    <div><div class="doc-etiquette">${h(d.locataire.libelle)}</div><strong>${h(d.locataire.nom)}</strong></div>
  </div>
  <div class="doc-bloc"><div class="doc-etiquette">Logement loué (${h(d.logement.type)})</div>${br(d.logement.adresse)}</div>
  <p class="doc-corps">${h(d.corps)}</p>
  <table class="doc-table"><tbody>${lignes}${bas}</tbody></table>
  ${d.paiement ? `<p class="doc-paiement">${h(d.paiement)}</p>` : ''}
  <div class="doc-signature">
    <div>${h(d.faitLe)}</div>
    <div class="doc-etiquette">Signature du bailleur</div>
    ${d.signature ? `<img src="${h(d.signature)}" alt="Signature">` : '<div class="doc-ligne-signature"></div>'}
  </div>
  <div class="doc-mentions">${d.mentions.map((m) => `<p>${h(m)}</p>`).join('')}</div>`;
}

// ---------- PDF ----------

let chargement = null;
export function chargerJsPdf(src) {
  if (window.jspdf) return Promise.resolve(window.jspdf);
  if (!chargement) {
    chargement = new Promise((ok, ko) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => ok(window.jspdf);
      s.onerror = () => { chargement = null; ko(new Error('Impossible de charger le module PDF.')); };
      document.head.appendChild(s);
    });
  }
  return chargement;
}

// Les polices standard du PDF couvrent le jeu WinAnsi : on remplace le reste par un équivalent proche.
const WINANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
export function pourPdf(t) {
  return String(t ?? '').replace(/[   ]/g, ' ').replace(/[^\n\x20-\x7e\xa0-\xff]/g, (c) => {
    if (WINANSI_EXTRA.includes(c)) return c;
    const base = c.normalize('NFKD').replace(/[̀-ͯ]/g, '');
    return /^[\x20-\x7e]+$/.test(base) ? base : '?';
  });
}

export async function genererPdf(d, srcJsPdf) {
  const { jsPDF } = await chargerJsPdf(srcJsPdf);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const T = (t) => pourPdf(t);
  const L = 20;
  const R = 190;
  const W = R - L;
  const encre = [20, 32, 46];
  const doux = [96, 110, 124];
  const accent = [13, 110, 98];
  doc.setProperties({ title: `${d.titre} — ${d.periode.libelle}`, subject: d.titre, creator: 'Quittance Tranquille' });

  // En-tête
  doc.setFillColor(...accent);
  doc.rect(0, 0, 210, 6, 'F');
  doc.setTextColor(...encre);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(T(d.titre.toUpperCase()), L, 26);
  doc.setFontSize(14);
  doc.setTextColor(...accent);
  doc.text(T(majuscule(d.periode.libelle)), L, 35);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...doux);
  doc.text(T(`Période ${d.periode.texte}`), L, 41);

  // Parties
  let y = 52;
  const bloc = (x, largeur, etiquette, nom, adresse) => {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...doux);
    doc.text(T(etiquette.toUpperCase()), x, y);
    doc.setFontSize(11);
    doc.setTextColor(...encre);
    const n = doc.splitTextToSize(T(nom), largeur);
    doc.text(n, x, y + 6);
    doc.setFont('helvetica', 'normal');
    const a = adresse ? doc.splitTextToSize(T(adresse), largeur) : [];
    if (a.length) doc.text(a, x, y + 6 + n.length * 5);
    return y + 6 + (n.length + a.length) * 5;
  };
  const b1 = bloc(L, 80, 'Bailleur', d.bailleur.nom, d.bailleur.adresse);
  const b2 = bloc(L + 90, 80, d.locataire.libelle, d.locataire.nom, '');
  y = Math.max(b1, b2) + 4;
  doc.setDrawColor(226, 232, 240);
  doc.line(L, y, R, y);
  y += 8;
  y = bloc(L, W, `Logement loué (${d.logement.type})`, d.logement.adresse.split('\n')[0], d.logement.adresse.split('\n').slice(1).join('\n')) + 6;

  // Corps
  doc.setFontSize(11);
  doc.setTextColor(...encre);
  const corps = doc.splitTextToSize(T(d.corps), W);
  doc.text(corps, L, y, { lineHeightFactor: 1.45 });
  y += corps.length * 5.6 + 6;

  // Tableau des montants
  const ligne = (libelle, valeur, style = 'normal', fond = null) => {
    if (fond) {
      doc.setFillColor(...fond);
      doc.rect(L, y - 5.5, W, 8.5, 'F');
    }
    doc.setFont('helvetica', style);
    doc.setTextColor(...encre);
    doc.text(T(libelle), L + 3, y);
    doc.text(T(euros(valeur)), R - 3, y, { align: 'right' });
    y += 8.5;
  };
  doc.setFontSize(11);
  for (const [l, v] of d.lignes) {
    ligne(l, v);
    doc.setDrawColor(226, 232, 240);
    doc.line(L, y - 5.5, R, y - 5.5);
  }
  if (d.partiel) {
    ligne('Total dû pour la période', d.total, 'bold', [241, 245, 249]);
    ligne('Somme versée', d.verse, 'bold', [230, 246, 240]);
    ligne('Reste dû', d.reste, 'bold', [253, 236, 234]);
  } else {
    ligne('Total payé', d.total, 'bold', [230, 246, 240]);
  }
  y += 2;
  if (d.paiement) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...encre);
    doc.text(T(d.paiement), L, y);
    y += 10;
  }

  // Signature
  y = Math.max(y + 4, 200);
  doc.text(T(d.faitLe), R - 75, y);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...doux);
  doc.text('SIGNATURE DU BAILLEUR', R - 75, y + 7);
  if (d.signature) {
    try { doc.addImage(d.signature, 'PNG', R - 75, y + 9, 60, 24); } catch { /* signature illisible : ignorée */ }
  } else {
    doc.setDrawColor(200, 208, 218);
    doc.line(R - 75, y + 30, R, y + 30);
  }

  // Mentions
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...doux);
  let ym = 272;
  doc.setDrawColor(226, 232, 240);
  doc.line(L, ym - 6, R, ym - 6);
  for (const m of d.mentions) {
    const t = doc.splitTextToSize(T(m), W);
    doc.text(t, L, ym);
    ym += t.length * 4;
  }
  return doc.output('blob');
}
