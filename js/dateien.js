"use strict";
// © 2026 Stefan R. – Alle Rechte vorbehalten.
// =====================================================
//  DOKUMENTE (PDF) – liegen im Browser-Speicher IndexedDB dieses Geräts.
//  Im Vorgang selbst steht nur die Liste (r.anhaenge: id, name, groesse, zeit), die Datei selbst liegt hier.
// =====================================================

const DATEI_DB = "retourix-dateien", DATEI_STORE = "dateien";
const MAX_DATEI_MB = 25;
let dateiDbVersprechen = null;

function dateiDb() {
  if (!dateiDbVersprechen) dateiDbVersprechen = new Promise((ok, fehler) => {
    const anf = indexedDB.open(DATEI_DB, 1);
    anf.onupgradeneeded = () => { const s = anf.result.createObjectStore(DATEI_STORE, { keyPath: "id" }); s.createIndex("vorgang", "vorgang"); };
    anf.onsuccess = () => ok(anf.result);
    anf.onerror = () => { dateiDbVersprechen = null; fehler(anf.error); };
  });
  return dateiDbVersprechen;
}
// kleine Hilfe: eine Anfrage in einer Transaktion ausführen
async function dateiTx(modus, arbeit) {
  const db = await dateiDb();
  return new Promise((ok, fehler) => {
    const tx = db.transaction(DATEI_STORE, modus), store = tx.objectStore(DATEI_STORE);
    let ergebnis;
    const anf = arbeit(store);
    if (anf) anf.onsuccess = () => { ergebnis = anf.result; };
    tx.oncomplete = () => ok(ergebnis);
    tx.onerror = tx.onabort = () => fehler(tx.error);
  });
}

const groesseText = b => (b >= 1048576 ? `${(b / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

// Datei(en) an einen Vorgang hängen
async function dateienHinzufuegen(r, dateien) {
  let anzahl = 0;
  for (const d of dateien) {
    if (!/pdf$/i.test(d.type) && !/\.pdf$/i.test(d.name)) { meldung(`„${d.name}“ ist keine PDF-Datei.`, "fehler"); continue; }
    if (d.size > MAX_DATEI_MB * 1048576) { meldung(`„${d.name}“ ist größer als ${MAX_DATEI_MB} MB.`, "fehler"); continue; }
    const eintrag = { id: neueId(), vorgang: r.id, name: d.name, typ: d.type || "application/pdf", groesse: d.size, zeit: new Date().toISOString() };
    await dateiTx("readwrite", s => s.put({ ...eintrag, blob: d }));
    (r.anhaenge ||= []).push({ id: eintrag.id, name: eintrag.name, groesse: eintrag.groesse, zeit: eintrag.zeit });
    r.verlauf.push({ zeit: eintrag.zeit, text: `Dokument hinzugefügt: ${d.name}` });
    anzahl++;
  }
  if (anzahl) { speichere(); navigator.storage?.persist?.().catch(() => {}); }
  return anzahl;
}
const dateiHolen = id => dateiTx("readonly", s => s.get(id));
async function dateiEntfernen(r, id) {
  await dateiTx("readwrite", s => s.delete(id));
  const a = (r.anhaenge || []).find(x => x.id === id);
  r.anhaenge = (r.anhaenge || []).filter(x => x.id !== id);
  if (a) r.verlauf.push({ zeit: new Date().toISOString(), text: `Dokument gelöscht: ${a.name}` });
  speichere();
}
// beim Löschen eines Vorgangs alle seine Dateien mitlöschen
async function dateienEntfernenVon(r) {
  try { await dateiTx("readwrite", s => { for (const a of r.anhaenge || []) s.delete(a.id); }); } catch (e) { /* egal */ }
}

// Öffnen (neuer Tab) und Herunterladen
async function dateiOeffnen(id) {
  const d = await dateiHolen(id);
  if (!d) { meldung("Datei nicht gefunden – liegt sie auf einem anderen Gerät?", "fehler"); return; }
  const url = URL.createObjectURL(d.blob);
  const a = document.createElement("a"); a.href = url; a.target = "_blank"; a.rel = "noopener"; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
async function dateiHerunterladen(id) {
  const d = await dateiHolen(id);
  if (!d) { meldung("Datei nicht gefunden – liegt sie auf einem anderen Gerät?", "fehler"); return; }
  const url = URL.createObjectURL(d.blob);
  const a = document.createElement("a"); a.href = url; a.download = d.name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ----- Sicherung: alle Dateien als Text (base64) mit in die Sicherungsdatei -----
const blobZuText = blob => new Promise((ok, fehler) => { const f = new FileReader(); f.onload = () => ok(f.result); f.onerror = () => fehler(f.error); f.readAsDataURL(blob); });
async function alleDateienFuerSicherung() {
  try {
    const alle = await dateiTx("readonly", s => s.getAll()) || [];
    const vorhanden = new Set(stand.reklamationen.map(r => r.id));
    const liste = [];
    for (const d of alle) if (vorhanden.has(d.vorgang)) { const { blob, ...rest } = d; liste.push({ ...rest, daten: await blobZuText(blob) }); }
    return liste;
  } catch (e) { return []; }
}
async function dateienAusSicherung(liste) {
  const eintraege = [];
  for (const d of liste) { const { daten, ...rest } = d; eintraege.push({ ...rest, blob: await (await fetch(daten)).blob() }); }
  await dateiTx("readwrite", s => { s.clear(); for (const e of eintraege) s.put(e); });
}
