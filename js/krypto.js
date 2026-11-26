"use strict";
// © 2026 Stefan R. – Alle Rechte vorbehalten.
// =====================================================
//  VERSCHLÜSSELUNG – AES-256-GCM, Schlüssel aus dem Kennwort per PBKDF2-SHA-256.
//  Ist sie eingeschaltet, liegen die Daten nur noch verschlüsselt im „Tresor“ (localStorage TRESOR),
//  PDFs verschlüsselt in IndexedDB, Sicherungen als verschlüsseltes Paket.
//  Das Kennwort selbst wird nirgends gespeichert – vergessen = Daten weg.
// =====================================================

const TRESOR = "retourix-tresor", KRYPTO_ITER = 310000, KENNWORT_MIN = 4, AUTO_SPERRE_MIN = 30;
const krypto = { schluessel: null, salz: null, iter: KRYPTO_ITER };

const zuB64 = buf => { const b = new Uint8Array(buf); let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
const ausB64 = t => Uint8Array.from(atob(t), c => c.charCodeAt(0));
const textBytes = t => new TextEncoder().encode(t);
const bytesText = b => new TextDecoder().decode(b);

async function schluesselAbleiten(kennwort, salz, iter) {
  const roh = await crypto.subtle.importKey("raw", textBytes(kennwort), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: salz, iterations: iter, hash: "SHA-256" }, roh, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function verschluesseln(schluessel, bytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return { iv, daten: await crypto.subtle.encrypt({ name: "AES-GCM", iv }, schluessel, bytes) };
}
const entschluesseln = (schluessel, iv, daten) => crypto.subtle.decrypt({ name: "AES-GCM", iv }, schluessel, daten);

const tresorVorhanden = () => { try { return !!localStorage.getItem(TRESOR); } catch (e) { return false; } };
const verschluesselt = () => !!krypto.schluessel;

// Ein Text als verschlüsseltes Paket (für Tresor und Sicherungsdatei)
async function paketPacken(schluessel, salz, iter, text) {
  const { iv, daten } = await verschluesseln(schluessel, textBytes(text));
  return { retourix: "verschluesselt", v: 1, salz: zuB64(salz), iter, iv: zuB64(iv), daten: zuB64(daten) };
}
// Paket öffnen – wirft einen Fehler, wenn das Kennwort falsch ist
async function paketOeffnen(paket, kennwort) {
  const salz = ausB64(paket.salz), schluessel = await schluesselAbleiten(kennwort, salz, paket.iter);
  const text = bytesText(await entschluesseln(schluessel, ausB64(paket.iv), ausB64(paket.daten)));
  return { schluessel, salz, iter: paket.iter, text };
}
const tresorPaket = () => JSON.parse(localStorage.getItem(TRESOR));

// Speichern in den Tresor – der Reihe nach, damit kein älterer Stand einen neueren überholt
let tresorKette = Promise.resolve();
function tresorSchreiben() {
  const text = JSON.stringify(stand), { schluessel, salz, iter } = krypto;
  tresorKette = tresorKette.then(async () => {
    localStorage.setItem(TRESOR, JSON.stringify(await paketPacken(schluessel, salz, iter, text)));
  }).catch(() => meldung("⚠️ Speichern ging nicht – ist der Speicher voll?", "fehler"));
  return tresorKette;
}

async function entsperren(kennwort) {
  const o = await paketOeffnen(tresorPaket(), kennwort);
  Object.assign(krypto, { schluessel: o.schluessel, salz: o.salz, iter: o.iter });
  stand = standAus(JSON.parse(o.text));
}

// Einschalten: neues Salz + Schlüssel, alle PDFs verschlüsseln, Klartext löschen
async function verschluesselungEin(kennwort) {
  const salz = crypto.getRandomValues(new Uint8Array(16)), schluessel = await schluesselAbleiten(kennwort, salz, KRYPTO_ITER);
  await dateienUmschluesseln(null, schluessel);
  Object.assign(krypto, { schluessel, salz, iter: KRYPTO_ITER });
  await tresorSchreiben();
  localStorage.removeItem(SPEICHER);
}
async function kennwortAendern(alt, neu) {
  await paketOeffnen(tresorPaket(), alt);   // prüft das alte Kennwort
  const salz = crypto.getRandomValues(new Uint8Array(16)), schluessel = await schluesselAbleiten(neu, salz, KRYPTO_ITER);
  await dateienUmschluesseln(krypto.schluessel, schluessel);
  Object.assign(krypto, { schluessel, salz, iter: KRYPTO_ITER });
  await tresorSchreiben();
}
async function verschluesselungAus(kennwort) {
  await paketOeffnen(tresorPaket(), kennwort);
  await tresorKette;
  await dateienUmschluesseln(krypto.schluessel, null);
  krypto.schluessel = null; krypto.salz = null;
  localStorage.setItem(SPEICHER, JSON.stringify(stand));
  localStorage.removeItem(TRESOR);
}
// Sperren = Seite neu laden (Schlüssel ist dann aus dem Speicher weg)
function sperren() { tresorKette.finally(() => location.reload()); }

// Automatisch sperren nach AUTO_SPERRE_MIN Minuten ohne Benutzung
let letzteAktivitaet = Date.now();
for (const ev of ["pointerdown", "keydown", "touchstart"]) addEventListener(ev, () => { letzteAktivitaet = Date.now(); }, { passive: true });
function pruefeAutoSperre() { if (verschluesselt() && Date.now() - letzteAktivitaet > AUTO_SPERRE_MIN * 60000) sperren(); }
setInterval(pruefeAutoSperre, 60000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") pruefeAutoSperre(); });
