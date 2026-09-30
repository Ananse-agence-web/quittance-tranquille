// Fichier agenda iCalendar (RFC 5545) généré dans le navigateur.

import { RYTHMES, ajouterJours, ajouterMois, echeance, premiereEcheance } from './dates.js';
import { euros } from './format.js';

const enc = new TextEncoder();

/** Échappement des valeurs texte : \ ; , et retours à la ligne */
export function echapper(t) {
  return String(t ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Pliage des lignes à 75 octets (sans couper un caractère UTF-8) */
export function plier(ligne) {
  const res = [];
  let courant = '';
  let taille = 0;
  for (const car of ligne) {
    const n = enc.encode(car).length;
    const max = res.length ? 74 : 75; // la ligne de continuation commence par une espace
    if (taille + n > max) {
      res.push(courant);
      courant = '';
      taille = 0;
    }
    courant += car;
    taille += n;
  }
  res.push(courant);
  return res.join('\r\n ');
}

/** Empreinte courte et stable (FNV-1a 32 bits) pour les UID */
export function empreinte(t) {
  let h = 0x811c9dc5;
  for (const o of enc.encode(t)) {
    h ^= o;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

function horodatageUtc(d) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

const compact = (isoDate) => isoDate.replace(/-/g, '');

const VTIMEZONE = [
  'BEGIN:VTIMEZONE', 'TZID:Europe/Paris',
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
  'END:VTIMEZONE',
];

/** Valeur BYMONTHDAY selon le jour du loyer et le choix pour les jours 29 à 31 */
export function jourRegle(bail) {
  if (bail.j <= 28) return bail.j;
  return bail.f === '28' ? 28 : -1;
}

export function regleRecurrence(bail, premier, nombre) {
  const n = RYTHMES[bail.r] || 1;
  const jour = jourRegle(bail);
  if (n === 12) return `RRULE:FREQ=YEARLY;BYMONTH=${premier[1] + 1};BYMONTHDAY=${jour};COUNT=${nombre}`;
  return `RRULE:FREQ=MONTHLY${n > 1 ? `;INTERVAL=${n}` : ''};BYMONTHDAY=${jour};COUNT=${nombre}`;
}

function alarme(declencheur, texte) {
  return ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${echapper(texte)}`, `TRIGGER:${declencheur}`, 'END:VALARM'];
}

const DECLENCHEURS = { 0: 'PT0M', 1: '-P1D', 3: '-P3D', 7: '-P1W' };

/**
 * @param bail  données du bail (voir configurateur)
 * @param opts  { heure: "09:00", rappels: [0,1,3,7], duree: mois, verif: jours après (0 = non), irl: "AAAA-MM-JJ" | "" }
 * @param url   lien vers la page de génération (avec le fragment)
 * @param maintenant Date
 */
export function genererIcs(bail, opts, url, maintenant = new Date(), urlGuideIrl = '') {
  const n = RYTHMES[bail.r] || 1;
  const duree = Math.min(36, Math.max(1, Number(opts.duree) || 12));
  const nombre = Math.max(1, Math.ceil(duree / n));
  const jourIso = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, '0')}-${String(maintenant.getDate()).padStart(2, '0')}`;
  const premier = premiereEcheance(bail, jourIso);
  const [hh, mm] = String(opts.heure || '09:00').split(':').map((x) => x.padStart(2, '0'));
  const heure = `T${hh}${mm}00`;
  const minutesFin = Math.min(23 * 60 + 59, Number(hh) * 60 + Number(mm) + 30);
  const finHeure = `T${String(Math.floor(minutesFin / 60)).padStart(2, '0')}${String(minutesFin % 60).padStart(2, '0')}00`;
  const stamp = horodatageUtc(maintenant);
  const graine = empreinte(JSON.stringify(bail) + duree + (opts.heure || ''));
  const total = (bail.y || 0) + (bail.c || 0);
  const qui = bail.l?.n || 'locataire';
  const lignes = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Quittance Tranquille//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${echapper('Quittances — ' + qui)}`, ...VTIMEZONE];

  const evenement = (uid, jour, resume, description, extra = []) => [
    'BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${stamp}`,
    `DTSTART;TZID=Europe/Paris:${compact(jour)}${heure}`, `DTEND;TZID=Europe/Paris:${compact(jour)}${finHeure}`,
    `SUMMARY:${echapper(resume)}`, `DESCRIPTION:${echapper(description)}`, ...extra, 'TRANSP:TRANSPARENT', 'END:VEVENT',
  ];

  // 1. Événement récurrent : loyer attendu -> générer la quittance
  const premierJour = echeance(premier[0], premier[1], bail.j, bail.f);
  const alarmes = [...new Set((opts.rappels || []).map(Number))].filter((r) => r in DECLENCHEURS).sort((a, b) => a - b)
    .flatMap((r) => alarme(DECLENCHEURS[r], r === 0 ? `Loyer de ${qui} : quittance à générer` : `Loyer de ${qui} attendu ${r === 1 ? 'demain' : `dans ${r} jours`}`));
  const desc = `Loyer attendu : ${euros(total)} (loyer ${euros(bail.y || 0)} + charges ${euros(bail.c || 0)}).\n\n`
    + `Une fois le paiement bien reçu, ouvrez ce lien pour générer la quittance en PDF :\n${url}\n\n`
    + 'Le lien contient les informations du bail : ne le partagez qu\'avec les personnes de confiance.';
  lignes.push(...evenement(`quittance-${graine}@quittance-tranquille`, premierJour, `Loyer de ${qui} — quittance à générer`, desc,
    [regleRecurrence(bail, premier, nombre), `URL:${url}`, ...alarmes]));

  // 2. Optionnel : vérifier l'arrivée du loyer N jours après l'échéance (événements individuels, exacts même en fin de mois)
  const verif = Number(opts.verif) || 0;
  if (verif > 0) {
    for (let k = 0; k < nombre; k++) {
      const [a, m] = ajouterMois(premier[0], premier[1], k * n);
      const jour = ajouterJours(echeance(a, m, bail.j, bail.f), verif);
      lignes.push(...evenement(`verif-${graine}-${k}@quittance-tranquille`, jour, `Loyer de ${qui} bien arrivé ?`,
        `Vérifiez que le loyer (${euros(total)}) est bien arrivé sur votre compte.\nSi oui, générez la quittance :\n${url}`,
        [`URL:${url}`, ...alarme('PT0M', `Loyer de ${qui} bien arrivé ?`)]));
    }
  }

  // 3. Optionnel : rappel annuel de révision du loyer (IRL)
  if (opts.irl && /^\d{4}-\d{2}-\d{2}$/.test(opts.irl)) {
    let [a, m, j] = opts.irl.split('-').map(Number);
    let jour = `${a}-${String(m).padStart(2, '0')}-${String(Math.min(j, 28)).padStart(2, '0')}`;
    while (jour < jourIso) { a += 1; jour = `${a}-${String(m).padStart(2, '0')}-${String(Math.min(j, 28)).padStart(2, '0')}`; }
    const annees = Math.max(1, Math.ceil(duree / 12));
    lignes.push(...evenement(`irl-${graine}@quittance-tranquille`, jour, `Révision annuelle du loyer (IRL) — ${qui}`,
      `Date de révision prévue au bail : pensez à calculer le nouveau loyer avec l'indice de référence des loyers (IRL) publié par l'INSEE.`
      + (urlGuideIrl ? `\nMode d'emploi : ${urlGuideIrl}` : '')
      + `\nAprès révision, corrigez simplement le montant dans la page de la quittance.`,
      [`RRULE:FREQ=YEARLY;COUNT=${annees}`, ...alarme('-P1W', `Révision du loyer de ${qui} dans une semaine`)]));
  }

  lignes.push('END:VCALENDAR');
  return lignes.map(plier).join('\r\n') + '\r\n';
}
