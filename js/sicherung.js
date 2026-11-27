"use strict";
// © 2026 Stefan R. – Alle Rechte vorbehalten.
// =====================================================
//  SICHERUNG – Sicherungsdatei erstellen, Erinnerung (nach 7 Tagen) und
//  automatische Sicherung in eine feste Datei (z. B. auf Stick / Netzlaufwerk).
//  Automatisch geht nur in Edge/Chrome am PC (File System Access) – nicht auf dem iPhone.
// =====================================================

const SICHERUNG_ERINNERN_TAGE = 7, AUTO_ZEIT = "retourix-autosicherung-zeit";

// Inhalt der Sicherungsdatei (verschlüsselt, wenn die Verschlüsselung an ist)
async function sicherungInhalt() {
  const text = JSON.stringify({ ...stand, dateien: await alleDateienFuerSicherung() }, null, 1);
  return verschluesselt() ? JSON.stringify(await paketPacken(krypto.schluessel, krypto.salz, krypto.iter, text)) : text;
}
// „Sicherung speichern“ (Download)
async function sicherungJetzt() {
  stand.letzteSicherung = new Date().toISOString(); speichere();
  ladeHerunter(`retourix-sicherung-${heute()}${verschluesselt() ? "-verschluesselt" : ""}.json`, await sicherungInhalt(), "application/json");
}

// ----- Erinnerung -----
const autoZeit = () => { try { return localStorage.getItem(AUTO_ZEIT) || ""; } catch (e) { return ""; } };
function letzteSicherungZeit() {
  const a = stand.letzteSicherung || "", b = autoZeit();
  return a > b ? a : b;
}
function sicherungsHinweis() {
  if (!stand.reklamationen.length || autoStatus === "bereit") return "";
  const z = letzteSicherungZeit(), tage = z ? Math.floor((Date.now() - new Date(z).getTime()) / 86400000) : null;
  if (tage !== null && tage < SICHERUNG_ERINNERN_TAGE) return "";
  return `<div class="hinweisBox sicherungHinweis">💾 ${tage === null ? "<b>Du hast noch keine Sicherung gespeichert.</b>" : `<b>Deine letzte Sicherung ist ${tage} Tage her.</b>`}
    Wenn der Browser-Speicher gelöscht wird, sind sonst alle Daten weg.
    <div class="knoepfe" style="margin-top:8px"><button type="button" class="knopf haupt klein" id="sicherungJetzt">💾 Jetzt sichern</button>
    ${autoMoeglich() ? `<button type="button" class="knopf klein" data-geh="einstellungen">Automatische Sicherung einrichten</button>` : ""}</div></div>`;
}

// ----- Automatische Sicherung -----
const autoMoeglich = () => typeof window.showSaveFilePicker === "function";
let autoGriff = null, autoStatus = "aus", autoUhr = null, autoFehler = "";   // aus | bereit | pausiert
const GRIFF_DB = "retourix-griffe";
function griffDb() {
  return new Promise((ok, fehler) => {
    const a = indexedDB.open(GRIFF_DB, 1);
    a.onupgradeneeded = () => a.result.createObjectStore("griffe");
    a.onsuccess = () => ok(a.result); a.onerror = () => fehler(a.error);
  });
}
async function griffTx(modus, arbeit) {
  const db = await griffDb();
  return new Promise((ok, fehler) => {
    const tx = db.transaction("griffe", modus); let erg; const anf = arbeit(tx.objectStore("griffe"));
    if (anf) anf.onsuccess = () => { erg = anf.result; };
    tx.oncomplete = () => ok(erg); tx.onerror = tx.onabort = () => fehler(tx.error);
  });
}
// beim Start (nach dem Entsperren): gemerkte Datei wieder aufnehmen
async function autoSicherungStart() {
  if (!autoMoeglich()) return;
  try {
    autoGriff = await griffTx("readonly", s => s.get("auto")) || null;
    if (!autoGriff) { autoStatus = "aus"; return; }
    autoStatus = (await autoGriff.queryPermission({ mode: "readwrite" })) === "granted" ? "bereit" : "pausiert";
  } catch (e) { autoStatus = "aus"; }
}
async function autoSicherungEinrichten() {
  const griff = await window.showSaveFilePicker({ suggestedName: `retourix-autosicherung${verschluesselt() ? "-verschluesselt" : ""}.json`,
    types: [{ description: "Retourix-Sicherung", accept: { "application/json": [".json"] } }] });
  autoGriff = griff; autoStatus = "bereit";
  await griffTx("readwrite", s => s.put(griff, "auto"));
  await autoSchreiben();
}
async function autoSicherungFortsetzen() {
  if (!autoGriff) return false;
  autoStatus = (await autoGriff.requestPermission({ mode: "readwrite" })) === "granted" ? "bereit" : "pausiert";
  if (autoStatus === "bereit") await autoSchreiben();
  return autoStatus === "bereit";
}
async function autoSicherungAus() {
  clearTimeout(autoUhr); autoGriff = null; autoStatus = "aus";
  try { await griffTx("readwrite", s => s.delete("auto")); } catch (e) { /* egal */ }
}
async function autoSchreiben() {
  if (autoStatus !== "bereit" || !autoGriff) return;
  try {
    const inhalt = await sicherungInhalt(), w = await autoGriff.createWritable();
    await w.write(inhalt); await w.close();
    localStorage.setItem(AUTO_ZEIT, new Date().toISOString()); autoFehler = "";
  } catch (e) {
    autoFehler = e?.name === "NotAllowedError" ? "" : "Schreiben ging nicht – ist der Stick / das Laufwerk da?";
    autoStatus = e?.name === "NotAllowedError" ? "pausiert" : autoStatus;
  }
}
// nach jeder Änderung (aus speichere()): kurz warten, dann schreiben
function autoSicherungPlanen() {
  if (autoStatus !== "bereit") return;
  clearTimeout(autoUhr); autoUhr = setTimeout(autoSchreiben, 2500);
}
