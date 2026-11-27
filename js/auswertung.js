"use strict";
// © 2026 Stefan R. – Alle Rechte vorbehalten.
// =====================================================
//  📊 AUSWERTUNG – Zahlen für einen Zeitraum (nach Erfassungsdatum):
//  Kennzahlen, je Lieferant, häufigste Artikel/Geräte, je Monat. Export als CSV.
// =====================================================

let auswZeitraum = "jahr";
const ZEITRAEUME = [["monat", "Dieser Monat"], ["3monate", "Letzte 3 Monate"], ["jahr", "Dieses Jahr"], ["vorjahr", "Letztes Jahr"], ["alles", "Alles"]];

function zeitraumGrenzen(z) {
  const h = new Date(), j = h.getFullYear(), m = h.getMonth(), iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (z === "monat") return [iso(new Date(j, m, 1)), iso(h)];
  if (z === "3monate") return [iso(new Date(j, m - 2, 1)), iso(h)];
  if (z === "jahr") return [`${j}-01-01`, iso(h)];
  if (z === "vorjahr") return [`${j - 1}-01-01`, `${j - 1}-12-31`];
  return ["0000", "9999"];
}
const tageZwischen = (a, b) => (new Date(b).getTime() - new Date(a).getTime()) / 86400000;
// Zeitpunkt, zu dem ein Vorgang einen Status bekommen hat (aus dem Verlauf)
function zeitpunktStatus(r, id) {
  const name = statusInfo(id).name.replaceAll("­", "");
  return (r.verlauf || []).find(v => v.text.replaceAll("­", "").startsWith(`Status: ${name}`))?.zeit || null;
}
const abgeschlossenAm = r => (istOffen(r) ? null : r.statusSeit || null);
// Betrag aus einem Gutschrift-Text wie „GS-123, 49,90 €“
function betragAus(text) {
  const m = String(text || "").match(/(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?\s*(?:€|EUR|Euro)/i);
  return m ? Number(m[1].replaceAll(".", "")) + (m[2] ? Number(m[2].padEnd(2, "0")) / 100 : 0) : 0;
}
const euro = n => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const schnitt = liste => (liste.length ? liste.reduce((a, b) => a + b, 0) / liste.length : null);
const tageText = n => (n === null ? "–" : `${n.toFixed(1).replace(".", ",")} Tage`);

function auswertungDaten() {
  const [von, bis] = zeitraumGrenzen(auswZeitraum);
  const liste = stand.reklamationen.filter(r => (r.datum || "") >= von && (r.datum || "") <= bis);
  const dauer = r => { const e = abgeschlossenAm(r); return e && r.status !== "abgelehnt" ? tageZwischen(r.erstellt || r.datum, e) : null; };
  const abholDauer = r => { const g = zeitpunktStatus(r, "gemeldet"), a = zeitpunktStatus(r, "abgeholt"); return g && a ? tageZwischen(g, a) : null; };
  const kenn = {
    gesamt: liste.length, retouren: liste.filter(r => artVon(r) === "artikel").length, reparaturen: liste.filter(r => artVon(r) === "reparatur").length,
    offen: liste.filter(istOffen).length, fertig: liste.filter(r => !istOffen(r) && r.status !== "abgelehnt").length, abgelehnt: liste.filter(r => r.status === "abgelehnt").length,
    dauer: schnitt(liste.map(dauer).filter(x => x !== null)), gutschrift: liste.reduce((s, r) => s + betragAus(r.gutschrift), 0),
  };
  const proLief = new Map();
  for (const r of liste) {
    const k = r.lieferant, e = proLief.get(k) || { name: lieferant(k)?.name || "(gelöscht)", n: 0, ret: 0, rep: 0, offen: 0, abgelehnt: 0, dauern: [], abhol: [], gs: 0 };
    e.n++; artVon(r) === "reparatur" ? e.rep++ : e.ret++; if (istOffen(r)) e.offen++; if (r.status === "abgelehnt") e.abgelehnt++;
    const d = dauer(r), a = abholDauer(r); if (d !== null) e.dauern.push(d); if (a !== null) e.abhol.push(a); e.gs += betragAus(r.gutschrift);
    proLief.set(k, e);
  }
  const lieferanten = [...proLief.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  const proArtikel = new Map();
  for (const r of liste) for (const p of r.positionen || []) {
    const k = (p.artikelnummer || p.bezeichnung || "").trim(); if (!k) continue;
    const e = proArtikel.get(k) || { bez: p.bezeichnung || "", nr: p.artikelnummer || "", vorgaenge: 0, stueck: 0 };
    e.vorgaenge++; e.stueck += Number(p.menge) || 1; if (!e.bez && p.bezeichnung) e.bez = p.bezeichnung; proArtikel.set(k, e);
  }
  const artikel = [...proArtikel.values()].sort((a, b) => b.vorgaenge - a.vorgaenge || b.stueck - a.stueck).slice(0, 10);
  const proMonat = new Map();
  for (const r of liste) { const k = (r.datum || "").slice(0, 7); const e = proMonat.get(k) || { ret: 0, rep: 0 }; artVon(r) === "reparatur" ? e.rep++ : e.ret++; proMonat.set(k, e); }
  const monate = [...proMonat.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  return { kenn, lieferanten, artikel, monate };
}

function zeichneAuswertung() {
  const { kenn, lieferanten, artikel, monate } = auswertungDaten();
  const monatName = k => new Date(`${k}-15`).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  $("inhalt").innerHTML = `<div class="leiste"><h2>📊 Auswertung</h2></div>
    <div class="filter zeitraum">${ZEITRAEUME.map(([id, n]) => `<button type="button" data-zeitraum="${id}" class="${auswZeitraum === id ? "an" : ""}">${n}</button>`).join("")}</div>
    <p class="leerKlein">Gezählt wird nach dem Datum der Erfassung.</p>
    <div class="kacheln auswKacheln">
      <div class="kachel" style="--f:#374151"><span>📋</span><b>${kenn.gesamt}</b><small>Vorgänge</small></div>
      <div class="kachel" style="--f:#d6001c"><span>📦</span><b>${kenn.retouren}</b><small>Retouren</small></div>
      <div class="kachel" style="--f:#027730"><span>🔧</span><b>${kenn.reparaturen}</b><small>Reparaturen</small></div>
      <div class="kachel" style="--f:#2563eb"><span>⏳</span><b>${kenn.offen}</b><small>noch offen</small></div>
      <div class="kachel" style="--f:#047857"><span>✅</span><b>${kenn.fertig}</b><small>abgeschlossen</small></div>
      <div class="kachel" style="--f:#dc2626"><span>⛔</span><b>${kenn.abgelehnt}</b><small>abgelehnt</small></div>
      <div class="kachel" style="--f:#7c3aed"><span>⏱️</span><b>${kenn.dauer === null ? "–" : kenn.dauer.toFixed(1).replace(".", ",")}</b><small>Ø Tage bis abgeschlossen</small></div>
      <div class="kachel" style="--f:#059669"><span>💶</span><b>${euro(kenn.gutschrift)}</b><small>Gutschriften</small></div>
    </div>
    ${kenn.gesamt ? `
    <section class="karte"><div class="leiste"><h3>🏭 Nach Lieferant</h3><button type="button" class="knopf klein" id="auswCsv">📊 Als Excel-Liste (CSV)</button></div>
      <table class="tabelle"><thead><tr><th>Lieferant</th><th>Vorgänge</th><th>Retouren</th><th>Reparaturen</th><th>offen</th><th>abgelehnt</th><th>Ø bis Abholung</th><th>Ø bis Abschluss</th><th>Gutschriften</th></tr></thead><tbody>
      ${lieferanten.map(l => `<tr><td><b>${esc(l.name)}</b></td><td>${l.n}</td><td>${l.ret}</td><td>${l.rep}</td><td>${l.offen}</td><td>${l.abgelehnt}</td>
        <td>${tageText(schnitt(l.abhol))}</td><td>${tageText(schnitt(l.dauern))}</td><td>${l.gs ? euro(l.gs) : "–"}</td></tr>`).join("")}</tbody></table>
      <small class="leerKlein">„Ø bis Abholung“: vom Melden beim Lieferanten bis zur Abholung. „Ø bis Abschluss“: von der Erfassung bis erledigt / ausgegeben. Gutschriften: Beträge aus dem Gutschrift-Feld (z. B. „49,90 €“).</small></section>
    ${artikel.length ? `<section class="karte"><h3>📦 Häufigste Artikel / Geräte</h3>
      <table class="tabelle"><thead><tr><th>Bezeichnung</th><th>Fawis</th><th>Vorgänge</th><th>Stück</th></tr></thead><tbody>
      ${artikel.map(a => `<tr><td><b>${esc(a.bez || "–")}</b></td><td>${esc(a.nr || "–")}</td><td>${a.vorgaenge}</td><td>${a.stueck}</td></tr>`).join("")}</tbody></table></section>` : ""}
    <section class="karte"><h3>📅 Nach Monat</h3>
      <table class="tabelle"><thead><tr><th>Monat</th><th>Retouren</th><th>Reparaturen</th><th>Gesamt</th></tr></thead><tbody>
      ${monate.map(([k, e]) => `<tr><td><b>${monatName(k)}</b></td><td>${e.ret}</td><td>${e.rep}</td><td>${e.ret + e.rep}</td></tr>`).join("")}</tbody></table></section>`
    : `<p class="leer">In diesem Zeitraum gibt es keine Vorgänge.</p>`}`;
  for (const b of document.querySelectorAll("[data-zeitraum]")) b.addEventListener("click", () => { auswZeitraum = b.dataset.zeitraum; zeichneAuswertung(); beschrifteTabellen(); });
  $("auswCsv")?.addEventListener("click", () => {
    const zeitraum = ZEITRAEUME.find(z => z[0] === auswZeitraum)[1];
    const zeilen = [["Lieferant", "Vorgänge", "Retouren", "Reparaturen", "offen", "abgelehnt", "Ø Tage bis Abholung", "Ø Tage bis Abschluss", "Gutschriften €"]]
      .concat(lieferanten.map(l => [l.name, l.n, l.ret, l.rep, l.offen, l.abgelehnt, ...[schnitt(l.abhol), schnitt(l.dauern)].map(x => (x === null ? "" : x.toFixed(1).replace(".", ","))), l.gs.toFixed(2).replace(".", ",")]));
    ladeHerunter(`retourix-auswertung-${zeitraum.toLowerCase().replaceAll(" ", "-")}-${heute()}.csv`, "﻿" + zeilen.map(z => z.map(w => `"${String(w ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n"), "text/csv");
  });
}
