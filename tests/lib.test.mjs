import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nombreEnLettres, montantEnLettres } from '../assets/js/lib/lettres.js';
import { periodeParDefaut, periode, echeance, premiereEcheance } from '../assets/js/lib/dates.js';
import { genererIcs, plier } from '../assets/js/lib/ics.js';
import { encoder, decoder } from '../assets/js/lib/lien.js';
import { euros, lireMontant } from '../assets/js/lib/format.js';

test('lettres', () => {
  const cas = { 0: 'zéro', 1: 'un', 21: 'vingt et un', 71: 'soixante et onze', 80: 'quatre-vingts', 81: 'quatre-vingt-un', 91: 'quatre-vingt-onze',
    99: 'quatre-vingt-dix-neuf', 100: 'cent', 200: 'deux cents', 280: 'deux cent quatre-vingts', 1000: 'mille', 1080: 'mille quatre-vingts',
    80000: 'quatre-vingt mille', 200000: 'deux cent mille', 1250: 'mille deux cent cinquante', 2000000: 'deux millions' };
  for (const [n, t] of Object.entries(cas)) assert.equal(nombreEnLettres(+n), t);
  assert.equal(montantEnLettres(85050), 'huit cent cinquante euros et cinquante centimes');
  assert.equal(montantEnLettres(101), 'un euro et un centime');
});

test('montants', () => {
  assert.equal(lireMontant('850,5'), 85050);
  assert.equal(lireMontant('1 200'), 120000);
  assert.ok(Number.isNaN(lireMontant('abc')));
  assert.equal(euros(123456), '1\u00a0234,56\u00a0€');
});

test('échéances fin de mois', () => {
  assert.equal(echeance(2027, 1, 31, 'dernier'), '2027-02-28');
  assert.equal(echeance(2028, 1, 30, 'dernier'), '2028-02-29');
  assert.equal(echeance(2026, 3, 31, 'dernier'), '2026-04-30');
  assert.equal(echeance(2026, 0, 31, '28'), '2026-01-28');
  assert.deepEqual(premiereEcheance({ j: 31, f: 'dernier' }, '2026-02-28'), [2026, 1]);
  assert.deepEqual(premiereEcheance({ j: 5 }, '2026-12-06'), [2027, 0]);
});

test('période par défaut', () => {
  assert.deepEqual(periodeParDefaut({ j: 5, r: 'm' }, '2026-10-08'), [2026, 9]);
  assert.deepEqual(periodeParDefaut({ j: 1, r: 'm' }, '2026-09-29'), [2026, 9]);
  assert.deepEqual(periodeParDefaut({ j: 1, r: 'm' }, '2026-12-30'), [2027, 0]);
  assert.deepEqual(periodeParDefaut({ j: 28, r: 'm' }, '2026-01-02'), [2025, 11]);
  assert.deepEqual(periodeParDefaut({ j: 5, r: 't', m0: '2026-01' }, '2026-05-20'), [2026, 3]);
  assert.equal(periode(2026, 10, 't').libelle, 'novembre 2026 à janvier 2027');
  assert.equal(periode(2028, 1, 'm').fin, '2028-02-29');
});

test('ics', () => {
  const bail = { b: { n: 'Jean Martin', a: '1 rue A, 75001 Paris' }, l: { n: 'Camille Dupont' }, a: '3 rue B; Lyon', y: 70000, c: 15000, j: 31, f: 'dernier', r: 'm' };
  const ics = genererIcs(bail, { heure: '09:00', rappels: [0, 1], duree: 12, verif: 2, irl: '2025-07-01' }, 'https://x.test/generer/#z' + 'a'.repeat(300), new Date(2026, 8, 29, 3));
  for (const l of ics.split('\r\n')) assert.ok(new TextEncoder().encode(l).length <= 75, l);
  assert.match(ics, /RRULE:FREQ=MONTHLY;BYMONTHDAY=-1;COUNT=12/);
  assert.match(ics, /DTSTART;TZID=Europe\/Paris:20260930T090000/);
  assert.match(ics, /TRIGGER:-P1D/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1 + 12 + 1);
  assert.match(ics, /DTSTART;TZID=Europe\/Paris:20261002T090000/); // vérif 2 jours après le 30/09
  assert.match(ics, /DTSTART;TZID=Europe\/Paris:20270701T090000/); // IRL
  assert.equal(plier('é'.repeat(80)).split('\r\n').length, 3);
});

test('lien', async () => {
  const bail = { v: 1, b: { n: 'Jean Martin', a: '1 rue A\n75001 Paris' }, l: { n: 'Camille Dupont', e: '' }, a: '3 rue B', y: 70000, c: 15000, j: 5, r: 'm' };
  const t = await encoder(bail);
  assert.equal(t[0], 'z');
  const d = await decoder('#' + t);
  assert.equal(d.b.a, '1 rue A\n75001 Paris');
  assert.equal(d.l.e, undefined);
  assert.equal(await decoder('#nimportequoi'), null);
  console.log('longueur du fragment :', t.length);
});
