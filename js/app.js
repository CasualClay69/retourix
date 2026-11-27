"use strict";
// © 2026 Stefan R. – Alle Rechte vorbehalten.
// =====================================================
//  RETOURIX – Anzeige und Bedienung
//  Zwei Arten: 📦 Retoure und 🔧 Kunden-Reparaturauftrag (siehe ARTEN / ABLAUF in daten.js)
//  Seiten: Übersicht · Neu · Lieferanten · Einstellungen · Detail
// =====================================================

const $ = id => document.getElementById(id);
const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const heute = () => new Date().toISOString().slice(0, 10);
const datumDe = d => (d ? new Date(d + (d.length === 10 ? "T12:00" : "")).toLocaleDateString("de-DE") : "–");
const tageSeit = d => Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
const zeilen = t => esc(t).replace(/\n/g, "<br>");
const artVon = r => (r.art === "reparatur" ? "reparatur" : "artikel");

let seite = "uebersicht", detailId = null, filter = "offen", artFilter = "alle", suche = "", bearbeiteLieferant = null, neueArt = "artikel";

function meldung(text, art = "") {
  const t = $("toast");
  t.textContent = text; t.className = "toast " + art; t.hidden = false;
  clearTimeout(meldung.uhr); meldung.uhr = setTimeout(() => { t.hidden = true; }, 3200);
}
function zeige(s, id = null) {
  seite = s; detailId = id;
  for (const b of document.querySelectorAll("#reiter button")) b.classList.toggle("an", b.dataset.seite === s);
  zeichne();
  window.scrollTo(0, 0);
}
function zeichne() {
  ({ uebersicht: zeichneUebersicht, neu: () => zeichneFormular(null), bearbeiten: () => zeichneFormular(detailId), detail: zeichneDetail,
     lieferanten: zeichneLieferanten, einstellungen: zeichneEinstellungen, auswertung: zeichneAuswertung })[seite]();
  beschrifteTabellen();
}
// Für die Handy-Ansicht: jede Zelle bekommt ihre Spaltenüberschrift (CSS zeigt die Zeilen dann als Karten)
function beschrifteTabellen() {
  for (const t of document.querySelectorAll("#inhalt .tabelle")) {
    const kopf = [...t.querySelectorAll("thead th")].map(th => th.textContent.trim());
    for (const tr of t.querySelectorAll("tbody tr")) [...tr.children].forEach((td, i) => { if (kopf[i]) td.dataset.l = kopf[i]; });
  }
}
function verdrahteLinks() {
  for (const a of document.querySelectorAll("#inhalt [data-geh]")) a.addEventListener("click", e => { e.preventDefault(); if (a.dataset.art) neueArt = a.dataset.art; zeige(a.dataset.geh); });
  for (const a of document.querySelectorAll("#inhalt [data-detail]")) a.addEventListener("click", e => { e.preventDefault(); zeige("detail", a.dataset.detail); });
}

// ===================== Erinnerungen =====================
function erinnerungen() {
  const e = stand.einstellungen, t1 = Number(e.erinnerungTage) || 7, t2 = Number(e.reparaturTage) || 21, liste = [];
  for (const r of stand.reklamationen) {
    const seit = tageSeit(r.statusSeit || r.erstellt);
    if (r.status === "gemeldet" && seit >= t1) liste.push({ r, text: `seit ${seit} Tagen keine Antwort vom Lieferanten` });
    if (artVon(r) === "reparatur" && ["abgeholt", "kva"].includes(r.status) && seit >= t2) liste.push({ r, text: `seit ${seit} Tagen beim Lieferanten in Reparatur` });
  }
  return liste;
}

// ===================== ÜBERSICHT =====================
function zeichneUebersicht() {
  const erin = erinnerungen(), erinIds = new Set(erin.map(x => x.r.id));
  const offenAnz = art => stand.reklamationen.filter(r => artVon(r) === art && istOffen(r)).length;
  const zaehle = id => stand.reklamationen.filter(r => r.status === id && (artFilter === "alle" || artVon(r) === artFilter)).length;
  const sichtbareStatus = STATUS.filter(s => !["abgelehnt", "erledigt", "ausgegeben"].includes(s.id) && (artFilter === "alle" ? Object.values(ABLAUF).some(a => a.includes(s.id)) : ABLAUF[artFilter].includes(s.id)));
  const liste = stand.reklamationen
    .filter(r => artFilter === "alle" || artVon(r) === artFilter)
    .filter(r => filter === "alle" || (filter === "offen" ? istOffen(r) : !istOffen(r)))
    .filter(r => !suche || JSON.stringify([r.nummer, r.auftragsNr, r.portalNr, r.retourennummer, r.reparaturnummer, (r.positionen || []).map(p => [p.lieferantNr, p.ean]), r.kunde, r.kundeTelefon, r.lieferschein, r.seriennummer, r.fehler, r.positionen, lieferant(r.lieferant)?.name]).toLowerCase().includes(suche.toLowerCase()))
    .sort((a, b) => (b.erstellt || "").localeCompare(a.erstellt || ""));
  $("inhalt").innerHTML = `
    ${!stand.lieferanten.length ? `<div class="hinweisBox">👋 Willkommen! Lege zuerst unter <a href="#" data-geh="lieferanten">🏭 Lieferanten</a> deine Lieferanten an.<div class="knoepfe" style="margin-top:8px"><button type="button" class="knopf klein" id="bspLaden">🧪 Erst mal ausprobieren: Beispieldaten laden</button></div></div>` : ""}
    ${autoStatus === "pausiert" ? `<div class="hinweisBox sicherungHinweis">💾 <b>Automatische Sicherung pausiert</b> – der Browser braucht einmal deine Erlaubnis, in die Datei „${esc(autoGriff?.name || "")}“ zu schreiben.
      <div class="knoepfe" style="margin-top:8px"><button type="button" class="knopf haupt klein" id="autoFortsetzen">▶️ Fortsetzen</button></div></div>` : sicherungsHinweis()}
    ${erin.length ? `<div class="hinweisBox warnung">⏰ <b>Bitte kümmern:</b><ul class="erinnerung">${erin.map(x => `<li><a href="#" data-detail="${x.r.id}">${ARTEN[artVon(x.r)].icon} ${esc(x.r.nummer)}</a> – ${esc(x.text)}</li>`).join("")}</ul></div>` : ""}
    <div class="neuKnoepfe">
      <button type="button" class="knopf haupt gross" data-geh="neu" data-art="artikel">📦 Neue Retoure <small>${offenAnz("artikel")} offen</small></button>
      <button type="button" class="knopf haupt gross blau" data-geh="neu" data-art="reparatur">🔧 Neuer Kunden-Reparaturauftrag <small>${offenAnz("reparatur")} offen</small></button>
    </div>
    <div class="kacheln">${sichtbareStatus.map(s => `<div class="kachel" style="--f:${s.farbe}"><span>${s.icon}</span><b>${zaehle(s.id)}</b><small>${s.name}</small></div>`).join("")}</div>
    <div class="leiste">
      <div class="filter">${[["alle", "Alle"], ["artikel", "📦 Retouren"], ["reparatur", "🔧 Reparaturen"]].map(([id, n]) => `<button type="button" data-artfilter="${id}" class="${artFilter === id ? "an" : ""}">${n}</button>`).join("")}</div>
      <div class="filter">${[["offen", "Offen"], ["fertig", "Erledigt"], ["alle", "Alle"]].map(([id, n]) => `<button type="button" data-filter="${id}" class="${filter === id ? "an" : ""}">${n}</button>`).join("")}</div>
      <input type="search" id="suche" placeholder="🔎 Suchen: Nummer, Auftragsnr., Kunde, Artikel, Seriennr., Lieferant …" value="${esc(suche)}">
    </div>
    ${liste.length ? `<table class="tabelle"><thead><tr><th>Nummer</th><th>Art</th><th>Datum</th><th>Lieferant</th><th>Auftragsnr.</th><th>Artikel / Gerät</th><th>Kunde</th><th>Status</th><th></th></tr></thead><tbody>
      ${liste.map(r => { const s = statusInfo(r.status), a = ARTEN[artVon(r)];
        return `<tr data-detail="${r.id}"><td><b>${esc(r.nummer)}</b>${r.anhaenge?.length ? ` <span class="klammer" title="${r.anhaenge.length} Dokument(e)">📎${r.anhaenge.length > 1 ? r.anhaenge.length : ""}</span>` : ""}</td><td title="${a.name}">${a.icon} ${a.kurz}</td><td>${datumDe(r.datum)}</td><td>${esc(lieferant(r.lieferant)?.name || "–")}</td><td class="nowrap">${esc(r.auftragsNr || "")}</td>
          <td>${esc((r.positionen || []).map(p => `${p.menge}× ${p.bezeichnung}`).join(", ").slice(0, 60))}</td><td>${esc(r.kunde || "")}</td>
          <td><span class="status" style="--f:${s.farbe}">${s.icon} ${s.name}</span>${erinIds.has(r.id) ? ` <span class="alt">⏰</span>` : ""}</td>
          <td class="loeschZelle"><button type="button" class="knopf klein gefahr" data-loeschen="${r.id}" title="Löschen" aria-label="${esc(r.nummer)} löschen">🗑️</button></td></tr>`; }).join("")}
    </tbody></table>` : `<p class="leer">${stand.reklamationen.length ? "Nichts in dieser Ansicht." : "Noch nichts erfasst."}</p>`}`;
  $("suche").addEventListener("input", e => { suche = e.target.value; const pos = e.target.selectionStart; zeichneUebersicht(); const s = $("suche"); s.focus(); s.setSelectionRange(pos, pos); });
  beschrifteTabellen();
  $("sicherungJetzt")?.addEventListener("click", async () => { await sicherungJetzt(); meldung("💾 Sicherung gespeichert"); zeichneUebersicht(); });
  $("autoFortsetzen")?.addEventListener("click", async () => { const ok = await autoSicherungFortsetzen(); meldung(ok ? "💾 Automatische Sicherung läuft wieder" : "Ohne Erlaubnis geht es nicht.", ok ? "" : "fehler"); zeichneUebersicht(); });
  for (const b of document.querySelectorAll("[data-loeschen]")) b.addEventListener("click", e => {
    e.stopPropagation();
    const r = reklamation(b.dataset.loeschen); if (!r) return;
    if (!confirm(`${ARTEN[artVon(r)].name} ${r.nummer} wirklich löschen? Das geht nicht rückgängig.`)) return;
    dateienEntfernenVon(r); stand.reklamationen = stand.reklamationen.filter(x => x.id !== r.id); speichere(); meldung(`🗑️ ${r.nummer} gelöscht`); zeichneUebersicht();
  });
  for (const b of document.querySelectorAll("[data-filter]")) b.addEventListener("click", () => { filter = b.dataset.filter; zeichneUebersicht(); });
  $("bspLaden")?.addEventListener("click", () => { ladeBeispieldaten(); meldung("🧪 Beispieldaten geladen"); zeichne(); });
  for (const b of document.querySelectorAll("[data-artfilter]")) b.addEventListener("click", () => { artFilter = b.dataset.artfilter; zeichneUebersicht(); });
  verdrahteLinks();
}

// ===================== NEU / BEARBEITEN =====================
function positionZeile(p = {}) {
  return `<div class="position"><input class="pArtnr" placeholder="Artikelnummer" value="${esc(p.artikelnummer)}">
    <input class="pBez" placeholder="Bezeichnung" value="${esc(p.bezeichnung)}"><input class="pMenge" type="number" min="1" step="1" placeholder="Menge" value="${esc(p.menge || 1)}">
    <button type="button" class="weg" title="Zeile entfernen">✕</button></div>`;
}
function zeichneFormular(id) {
  const r = id ? reklamation(id) : null, art = r ? artVon(r) : neueArt, rep = art === "reparatur";
  if (!stand.lieferanten.length) {
    $("inhalt").innerHTML = `<div class="hinweisBox">🏭 Lege zuerst unter <a href="#" data-geh="lieferanten">Lieferanten</a> mindestens einen Lieferanten an.</div>`;
    return verdrahteLinks();
  }
  $("inhalt").innerHTML = `<h2>${r ? `✏️ ${esc(r.nummer)} bearbeiten` : `${ARTEN[art].icon} Neue ${ARTEN[art].name}`}</h2>
    ${r ? "" : `<div class="filter artWahl">${Object.entries(ARTEN).map(([k, a]) => `<button type="button" data-neuart="${k}" class="${art === k ? "an" : ""}">${a.icon} ${a.name}</button>`).join("")}</div>`}
    <form id="form" class="formular">
      <label>Datum<input type="date" name="datum" value="${esc(r?.datum || heute())}" required></label>
      <label>Lieferant<select name="lieferant" required>${stand.lieferanten.slice().sort((a, b) => a.name.localeCompare(b.name)).map(l => `<option value="${l.id}" ${r?.lieferant === l.id ? "selected" : ""}>${esc(l.name)}</option>`).join("")}</select></label>
      ${rep ? `<label>Reparaturnummer<input name="reparaturnummer" id="repNr" value="${esc(r?.reparaturnummer)}" placeholder="3681-xxxxxx-xxxx-xx" inputmode="numeric" autocomplete="off" maxlength="19" required></label>
        <fieldset class="breit kundeBox"><legend>👤 Kunde <small>(bleibt intern)</small></legend>
          <label>Name<input name="kunde" value="${esc(r?.kunde)}" required></label>
          <label>Telefon<input name="kundeTelefon" value="${esc(r?.kundeTelefon)}"></label>
        </fieldset>`
        : `<label>Retourennummer<input name="retourennummer" value="${esc(r?.retourennummer)}" placeholder="z. B. 133xxxxxxxx" inputmode="numeric" autocomplete="off" required></label>
          <label>Lieferschein / Rechnung<input name="lieferschein" value="${esc(r?.lieferschein)}" placeholder="z. B. LS 4711"></label>`}
      ${rep ? (g => `<fieldset class="breit kundeBox geraetBox"><legend>🔧 Gerät</legend>
          <label class="ganz">Bezeichnung<input name="gBez" value="${esc(g.bezeichnung)}" placeholder="z. B. Akku-Bohrschrauber 18 V"></label>
          <label>Unsere Artikelnummer<input name="gArtnr" value="${esc(g.artikelnummer)}" inputmode="numeric" autocomplete="off"></label>
          <label><span>Ihre Artikelnummer <small>(Lieferant)</small></span><input name="gLiefNr" value="${esc(g.lieferantNr)}" autocomplete="off"></label>
          <label>EAN<input name="gEan" value="${esc(g.ean)}" inputmode="numeric" autocomplete="off" placeholder="13-stellig"></label>
        </fieldset>`)(r?.positionen?.[0] || {})
        : `<div class="breit"><b>Artikel</b><div id="positionen">${(r?.positionen?.length ? r.positionen : [{}]).map(positionZeile).join("")}</div>
        <button type="button" class="knopf klein" id="plusPosition">+ weiterer Artikel</button></div>`}
      ${rep ? `<label>Seriennummer<input name="seriennummer" value="${esc(r?.seriennummer)}"></label>
        <label>Kaufdatum<input type="date" name="kaufdatum" value="${esc(r?.kaufdatum)}"></label>
        <label>Mitgegebenes Zubehör<input name="zubehoer" value="${esc(r?.zubehoer)}" placeholder="z. B. 2 Akkus, Ladegerät, Koffer"></label>` : ""}
      <label class="breit">Fehlerbeschreibung<textarea name="fehler" rows="4" required placeholder="Was ist kaputt / falsch?">${esc(r?.fehler)}</textarea></label>
      <label>Anzahl Pakete<input type="number" name="pakete" min="1" value="${esc(r?.pakete || 1)}"></label>
      <label>Gewicht gesamt (kg)<input type="number" name="gewicht" min="0" step="0.1" value="${esc(r?.gewicht || "")}"></label>
      <label class="breit">Interne Notiz <small>(nur für dich)</small><textarea name="notiz" rows="2">${esc(r?.notiz)}</textarea></label>
      <div class="breit knoepfe"><button type="submit" class="knopf haupt">💾 Speichern</button><button type="button" class="knopf" id="abbrechen">Abbrechen</button></div>
    </form>`;
  for (const b of document.querySelectorAll("[data-neuart]")) b.addEventListener("click", () => { neueArt = b.dataset.neuart; zeichneFormular(null); });
  const pos = $("positionen");
  $("plusPosition")?.addEventListener("click", () => { pos.insertAdjacentHTML("beforeend", positionZeile()); });
  // Reparaturnummer beim Tippen automatisch gliedern: 3681-xxxxxx-xxxx-xx
  $("repNr")?.addEventListener("input", e => {
    const z = e.target.value.replace(/\D/g, "").slice(0, 16), teile = [z.slice(0, 4), z.slice(4, 10), z.slice(10, 14), z.slice(14, 16)].filter(Boolean);
    // nach 4, 10 und 14 Ziffern kommt der Strich von selbst (und ein getippter Strich bleibt stehen) – nur beim Löschen nicht
    e.target.value = teile.join("-") + (e.inputType !== "deleteContentBackward" && [4, 10, 14].includes(z.length) ? "-" : "");
  });
  pos?.addEventListener("click", e => { if (e.target.classList.contains("weg") && pos.children.length > 1) e.target.closest(".position").remove(); });
  $("abbrechen").addEventListener("click", () => (r ? zeige("detail", r.id) : zeige("uebersicht")));
  $("form").addEventListener("submit", e => {
    e.preventDefault();
    const f = new FormData(e.target), w = k => (f.get(k) ?? "").toString().trim();
    const positionen = rep
      ? [{ bezeichnung: w("gBez"), artikelnummer: w("gArtnr"), lieferantNr: w("gLiefNr"), ean: w("gEan"), menge: 1 }].filter(p => p.bezeichnung || p.artikelnummer || p.lieferantNr || p.ean)
      : [...pos.querySelectorAll(".position")].map(z => ({ artikelnummer: z.querySelector(".pArtnr").value.trim(), bezeichnung: z.querySelector(".pBez").value.trim(),
      menge: Number(z.querySelector(".pMenge").value) || 1 })).filter(p => p.artikelnummer || p.bezeichnung);
    if (!positionen.length) { meldung(`Bitte ${rep ? "das Gerät" : "mindestens einen Artikel"} eintragen.`, "fehler"); return; }
    const daten = { art, datum: w("datum"), lieferant: w("lieferant"), lieferschein: w("lieferschein"), positionen, fehler: w("fehler"),
      pakete: Number(w("pakete")) || 1, gewicht: w("gewicht"), notiz: w("notiz") };
    if (rep) daten.kunde = w("kunde"); else daten.retourennummer = w("retourennummer");
    if (rep) Object.assign(daten, { reparaturnummer: w("reparaturnummer"), kundeTelefon: w("kundeTelefon"), seriennummer: w("seriennummer"), kaufdatum: w("kaufdatum"), zubehoer: w("zubehoer") });
    daten.nummer = rep ? daten.reparaturnummer : daten.retourennummer;
    if (stand.reklamationen.some(x => x !== r && x.nummer === daten.nummer)) { meldung(`Die ${rep ? "Reparaturnummer" : "Retourennummer"} ${daten.nummer} gibt es schon.`, "fehler"); return; }
    let ziel = r;
    if (r) { Object.assign(r, daten); r.verlauf.push({ zeit: new Date().toISOString(), text: "Bearbeitet" }); }
    else {
      ziel = { id: neueId(), nummer: daten.nummer, erstellt: new Date().toISOString(), status: "neu", statusSeit: new Date().toISOString(),
        verlauf: [{ zeit: new Date().toISOString(), text: "Erfasst" }], ...daten };
      stand.reklamationen.push(ziel);
    }
    speichere(); meldung(`💾 ${ziel.nummer} gespeichert`); zeige("detail", ziel.id);
  });
  verdrahteLinks();
}

// ===================== VORLAGEN & MAIL =====================
function fuelleVorlage(text, r) {
  const l = lieferant(r.lieferant) || {}, e = stand.einstellungen, ap = l.ansprechpartner || "";
  const g = (r.positionen || [])[0] || {}, geraet = (r.positionen || []).map(p => p.bezeichnung).filter(Boolean).join(", ");
  const werte = {
    "{nummer}": r.nummer, "{datum}": datumDe(r.datum), "{kundennummer}": l.kundennummer || "–",
    "{anrede}": /^Frau\s/i.test(ap) ? `Sehr geehrte ${ap}` : /^Herr\s/i.test(ap) ? `Sehr geehrter ${ap}` : "Sehr geehrte Damen und Herren",
    "{positionen}": (r.positionen || []).map(p => `- ${p.menge} × ${p.artikelnummer ? `${p.artikelnummer} ` : ""}${p.bezeichnung}`).join("\n"),
    "{lieferschein}": r.lieferschein || "–", "{retourennummer}": r.retourennummer || r.nummer || "–", "{reparaturnummer}": r.reparaturnummer || "–", "{fehler}": r.fehler || "–", "{pakete}": r.pakete || 1, "{gewicht}": r.gewicht || "–",
    "{abholadresse}": "", "{abholhinweis}": l.abholhinweis || e.abholhinweis || "",
    "{name}": "", "{firma}": "", "{telefon}": "", "{email}": "",   // Absender kommt aus der Outlook-Signatur
    "{geraet}": geraet || "–", "{seriennummer}": r.seriennummer || "–", "{kaufdatum}": r.kaufdatum ? datumDe(r.kaufdatum) : "–", "{beleg}": r.beleg || "–",
    "{garantie}": r.garantie || "–", "{kostenlimit}": r.kostenlimit || "–",   // nur für alte Vorlagen
    "{artikelnummer}": g.artikelnummer || "–", "{lieferantenartikelnr}": g.lieferantNr || "–", "{ean}": g.ean || "–", "{zubehoer}": r.zubehoer || "keins", "{kundenname}": r.kunde || "",
  };
  return text.replace(/\{[a-z_]+\}/g, k => (k in werte ? werte[k] : k)).replace(/(\n[ \t]*(Tel\.)?[ \t]*)+$/, "").replace(/\n{3,}/g, "\n\n");
}
function mailFuer(r) {
  const l = lieferant(r.lieferant) || {}, rep = artVon(r) === "reparatur";
  return { an: l.email || "", cc: "",
    betreff: fuelleVorlage((rep ? l.betreffReparatur : l.betreff) || (rep ? STANDARD_REP_BETREFF : STANDARD_BETREFF), r),
    text: fuelleVorlage((rep ? l.vorlageReparatur : l.vorlage) || (rep ? STANDARD_REP_TEXT : STANDARD_TEXT), r) };
}
// Meldeweg des Lieferanten: "email" (Standard) oder "portal"
const istPortal = l => l?.meldeweg === "portal";
const portalLink = u => (!u ? "" : /^https?:\/\//i.test(u) ? u : `https://${u}`);
// Die wichtigsten Angaben einzeln – zum Abtippen/Kopieren ins Portal des Lieferanten
function portalAngaben(r) {
  const l = lieferant(r.lieferant) || {}, g = (r.positionen || [])[0] || {}, rep = artVon(r) === "reparatur";
  const z = rep ? [
    ["Unsere Kundennummer", l.kundennummer], ["Reparaturnummer", r.nummer], ["Gerät", g.bezeichnung], ["Unsere Artikelnummer", g.artikelnummer],
    ["Ihre Artikelnummer", g.lieferantNr], ["EAN", g.ean], ["Seriennummer", r.seriennummer], ["Kaufdatum", r.kaufdatum ? datumDe(r.kaufdatum) : ""],
    ["Zubehör", r.zubehoer], ["Fehlerbeschreibung", r.fehler],
  ] : [
    ["Unsere Kundennummer", l.kundennummer], ["Retourennummer", r.nummer], ["Lieferschein / Rechnung", r.lieferschein],
    ...(r.positionen || []).map((p, i) => [`Artikel ${(r.positionen.length > 1) ? i + 1 : ""}`.trim(), `${p.menge} × ${p.artikelnummer ? `${p.artikelnummer} ` : ""}${p.bezeichnung}`]),
    ["Fehlerbeschreibung", r.fehler],
  ];
  z.push(["Pakete / Gewicht", `${r.pakete || 1} Paket(e)${r.gewicht ? `, ca. ${r.gewicht} kg` : ""}`]);
  return z.filter(([, w]) => w);
}
const mailtoLink = m => `mailto:${encodeURIComponent(m.an).replace(/%40/g, "@").replace(/%2C/g, ",")}?${[m.cc && `cc=${encodeURIComponent(m.cc)}`, `subject=${encodeURIComponent(m.betreff)}`, `body=${encodeURIComponent(m.text.replace(/\r?\n/g, "\r\n"))}`].filter(Boolean).join("&")}`;
async function kopiere(text, was) {
  try { await navigator.clipboard.writeText(text); meldung(`📋 ${was} kopiert`); } catch (e) { meldung("Kopieren ging nicht – markiere den Text in der Vorschau.", "fehler"); }
}

// ===================== DETAIL =====================
function setzeStatus(r, neu, extra = "") {
  r.status = neu; r.statusSeit = new Date().toISOString();
  r.verlauf.push({ zeit: r.statusSeit, text: `Status: ${statusInfo(neu).name}${extra ? ` – ${extra}` : ""}` });
  speichere();
}
// Was gehört zu jedem Schritt? (Titel + Bedienelemente)
function schrittInhalt(id, r, m) {
  const rep = artVon(r) === "reparatur";
  switch (id) {
    case "gemeldet": {
      const l = lieferant(r.lieferant) || {};
      const markieren = r.status === "neu" ? `<button type="button" class="knopf klein" data-status="gemeldet">✔ Als gemeldet markieren</button>` : "";
      if (istPortal(l)) return { titel: "Im Portal des Lieferanten melden", html: `<div class="knoepfe">${l.portalUrl ? `<a class="knopf haupt" id="portalOeffnen" href="${esc(portalLink(l.portalUrl))}" target="_blank" rel="noopener">🌐 Portal öffnen</a>` : ""}<button type="button" class="knopf" id="portalKopieren">📋 Alle Angaben kopieren</button></div>
        ${l.portalUrl ? "" : `<small class="warn">⚠️ Beim Lieferanten ist keine Portal-Adresse eingetragen.</small>`}${l.portalHinweis ? `<small>💡 ${esc(l.portalHinweis)}</small>` : ""}
        ${l.portalBenutzer || l.portalKennwort ? `<div class="zugang">${l.portalBenutzer ? `<span>👤 <b>${esc(l.portalBenutzer)}</b> <button type="button" class="knopf klein" id="benutzerKopieren" title="Benutzer kopieren">📋</button></span>` : ""}
          ${l.portalKennwort ? `<span>🔑 <b id="kwAnzeige">••••••••</b> <button type="button" class="knopf klein" id="kwAnsehen" title="Kennwort zeigen">👁️</button><button type="button" class="knopf klein" id="kwKopieren" title="Kennwort kopieren">📋</button></span>` : ""}</div>` : ""}
        <div class="zeile"><label>Vorgangsnr. im Portal <input id="portalNr" value="${esc(r.portalNr || "")}" placeholder="falls das Portal eine vergibt"></label><button type="button" class="knopf klein" id="portalNrSpeichern">💾</button></div>
        ${markieren}` };
      return { titel: "Beim Lieferanten melden", html: `${m.an ? `<div class="knoepfe"><a class="knopf haupt" id="mailOutlook" href="${esc(mailtoLink(m))}">✉️ E-Mail in Outlook öffnen</a><button type="button" class="knopf" id="mailKopieren">📋 Text kopieren</button></div>
        <small>An: ${esc(m.an)} · Fotos hängst du in Outlook an.</small>` : `<small class="warn">⚠️ Beim Lieferanten ist keine E-Mail-Adresse eingetragen.</small>`}
        ${markieren}` };
    }
    case "abholung": return { titel: "Abholung vorbereiten", html: `<div class="zeile"><label>Auftragsnr. des Lieferanten <input id="auftragsNr" value="${esc(r.auftragsNr || "")}" placeholder="z. B. RMA-12345" autocomplete="off"></label><button type="button" class="knopf klein" id="auftragsNrSpeichern">💾 Speichern</button></div><div class="zeile"><label>Abholtermin <input type="date" id="abholtermin" value="${esc(r.abholtermin || "")}"></label><button type="button" class="knopf klein" id="terminSpeichern">📅 Termin eintragen</button></div>` };
    case "abgeholt": return { titel: "Abgeholt", html: `<button type="button" class="knopf klein" data-status="abgeholt">🚚 ${rep ? "Gerät" : "Ware"} wurde abgeholt</button>` };
    case "gutschrift": return { titel: "Gutschrift / Ersatz", html: `<div class="zeile"><input id="gutschriftText" placeholder="z. B. Gutschrift GS-123, 49,90 €" value="${esc(r.gutschrift || "")}"><button type="button" class="knopf klein" data-status="gutschrift">💶 Erhalten</button></div>` };
    case "kva": return { titel: "Kostenvoranschlag (falls nötig)", html: `<div class="zeile"><input id="kvaText" placeholder="z. B. 89 € – Motor tauschen" value="${esc(r.kva || "")}"><button type="button" class="knopf klein" data-status="kva">🧾 KVA erhalten</button></div>
        ${r.status === "kva" ? `<div class="zeile"><button type="button" class="knopf klein" id="kvaJa">👍 Kunde stimmt zu</button><button type="button" class="knopf klein gefahr" id="kvaNein">👎 Kunde lehnt ab</button></div>` : ""}
        <small>Kein KVA nötig? Dann einfach den nächsten Schritt nehmen.</small>` };
    case "zurueck": return { titel: "Zurück im Markt", html: `<button type="button" class="knopf klein" data-status="zurueck">📥 Gerät ist zurück</button>${r.kundeTelefon ? `<small>Kunde anrufen: <a href="tel:${esc(r.kundeTelefon.replace(/[^\d+]/g, ""))}">📞 ${esc(r.kundeTelefon)}</a></small>` : ""}` };
    case "ausgegeben": return { titel: "An Kunden ausgegeben", html: `<button type="button" class="knopf klein" data-status="ausgegeben">🤝 Kunde hat das Gerät abgeholt</button>` };
    case "erledigt": return { titel: "Erledigt", html: "" };
    default: return null;
  }
}
function zeichneDetail() {
  const r = reklamation(detailId);
  if (!r) return zeige("uebersicht");
  const art = artVon(r), rep = art === "reparatur", A = ARTEN[art], l = lieferant(r.lieferant), s = statusInfo(r.status), m = mailFuer(r);
  const ablauf = ABLAUF[art], jetzt = ablauf.indexOf(r.status);
  const schritte = ablauf.slice(1).map((id, i) => {
    const inh = schrittInhalt(id, r, m), nr = i + 1, idx = i + 1;
    if (!inh) return "";
    const zustand = FERTIG.includes(r.status) || idx <= jetzt ? "fertig" : idx === jetzt + 1 ? "jetzt" : "";
    return `<div class="schritt ${zustand}"><b>${nr}. ${inh.titel}</b>${zustand === "fertig" && id !== r.status && !["gemeldet", "abholung"].includes(id) ? "" : inh.html}</div>`;
  }).join("");
  $("inhalt").innerHTML = `
    <div class="detailKopf"><div><h2>${A.icon} ${esc(r.nummer)} <small class="artName">${A.name}</small></h2><span class="status gross" style="--f:${s.farbe}">${s.icon} ${s.name}</span> <small>seit ${datumDe(r.statusSeit?.slice(0, 10))}</small></div>
      <div class="knoepfe"><button type="button" class="knopf" id="bearbeiten">✏️ Bearbeiten</button><button type="button" class="knopf" id="zurueck">← Übersicht</button></div></div>
    <div class="spalten">
      <section class="karte"><h3>📋 ${rep ? "Reparaturauftrag" : "Retoure"}</h3><dl>
        <dt>Datum</dt><dd>${datumDe(r.datum)}</dd><dt>Lieferant</dt><dd>${esc(l?.name || "–")}</dd>${rep ? `<dt>Kunde</dt><dd>${esc(r.kunde || "–")}</dd>` : `${r.kunde ? `<dt>Kunde</dt><dd>${esc(r.kunde)}</dd>` : ""}`}
        ${rep ? `<dt>Telefon</dt><dd>${esc(r.kundeTelefon || "–")}</dd>${r.kundeEmail ? `<dt>E-Mail</dt><dd>${esc(r.kundeEmail)}</dd>` : ""}
          ${(g => `<dt>Gerät</dt><dd>${esc(g.bezeichnung || "–")}</dd><dt>Unsere Art.-Nr.</dt><dd>${esc(g.artikelnummer || "–")}</dd>
          <dt>Ihre Art.-Nr.</dt><dd>${esc(g.lieferantNr || "–")}</dd><dt>EAN</dt><dd>${esc(g.ean || "–")}</dd>`)((r.positionen || [])[0] || {})}
          <dt>Seriennummer</dt><dd>${esc(r.seriennummer || "–")}</dd><dt>Kaufdatum</dt><dd>${r.kaufdatum ? datumDe(r.kaufdatum) : "–"}</dd><dt>Zubehör</dt><dd>${esc(r.zubehoer || "keins")}</dd>
          ${r.kva ? `<dt>Kosten&shy;voranschlag</dt><dd>${esc(r.kva)}${r.kvaAntwort ? ` – ${esc(r.kvaAntwort)}` : ""}</dd>` : ""}`
        : `<dt>Lieferschein</dt><dd>${esc(r.lieferschein || "–")}</dd>`}
        ${r.auftragsNr ? `<dt>Auftragsnr. Lieferant</dt><dd>${esc(r.auftragsNr)}</dd>` : ""}
        ${r.portalNr ? `<dt>Vorgangsnr. Portal</dt><dd>${esc(r.portalNr)}</dd>` : ""}
        <dt>Pakete / Gewicht</dt><dd>${esc(r.pakete || 1)} / ${esc(r.gewicht || "–")} kg</dd>
        ${r.abholtermin ? `<dt>Abholtermin</dt><dd><b>${datumDe(r.abholtermin)}</b></dd>` : ""}${r.gutschrift ? `<dt>Gutschrift</dt><dd>${esc(r.gutschrift)}</dd>` : ""}</dl>
        ${rep ? "" : `<table class="tabelle klein"><thead><tr><th>Artikelnr.</th><th>Bezeichnung</th><th>Menge</th></tr></thead><tbody>${(r.positionen || []).map(p => `<tr><td>${esc(p.artikelnummer)}</td><td>${esc(p.bezeichnung)}</td><td>${esc(p.menge)}</td></tr>`).join("")}</tbody></table>`}
        <p class="fehlerText"><b>Fehler:</b> ${zeilen(r.fehler)}</p>${r.notiz ? `<p class="notiz">📝 ${zeilen(r.notiz)}</p>` : ""}</section>
      <section class="karte"><h3>⚡ Nächste Schritte</h3>${schritte}
        <div class="knoepfe unten">${!FERTIG.includes(r.status) ? `<button type="button" class="knopf" data-status="${rep ? "ausgegeben" : "erledigt"}">✅ ${rep ? "Abgeschlossen" : "Erledigt"}</button>` : ""}${r.status !== "abgelehnt" ? `<button type="button" class="knopf gefahr" data-status="abgelehnt">⛔ Abgelehnt</button>` : ""}
          <select id="statusWahl"><option value="">Status direkt setzen …</option>${STATUS.filter(x => ablauf.includes(x.id) || ["abgelehnt", "erledigt"].includes(x.id)).map(x => `<option value="${x.id}">${x.icon} ${x.name}</option>`).join("")}</select></div>
      </section>
    </div>
    <section class="karte"><h3>📎 Dokumente</h3>
      ${r.anhaenge?.length ? `<ul class="dokumente">${r.anhaenge.map(a => `<li><button type="button" class="dokName" data-dokauf="${a.id}" title="Öffnen">📄 ${esc(a.name)}</button>
        <small>${groesseText(a.groesse)} · ${new Date(a.zeit).toLocaleDateString("de-DE")}</small>
        <span class="knoepfe"><button type="button" class="knopf klein" data-dokauf="${a.id}">👁️ Öffnen</button><button type="button" class="knopf klein" data-dokladen="${a.id}">⬇️ Herunterladen</button>
        <button type="button" class="knopf klein gefahr" data-dokweg="${a.id}" aria-label="${esc(a.name)} löschen">🗑️</button></span></li>`).join("")}</ul>` : `<p class="leerKlein">Noch keine Dokumente.</p>`}
      <label class="knopf"><input type="file" id="dokNeu" accept="application/pdf,.pdf" multiple hidden>➕ PDF hinzufügen</label>
      <small class="dokHinweis">Die PDFs bleiben auf diesem Gerät. Zum Anhängen an die Outlook-Mail: herunterladen und in die Mail ziehen.</small></section>
    ${istPortal(l) ? `<section class="karte"><h3>🌐 Angaben für das Portal</h3><p class="leerKlein">Einzeln kopieren und im Portal in die passenden Felder einfügen.</p>
      <table class="portalTab">${portalAngaben(r).map(([k, w], i) => `<tr><th>${esc(k)}</th><td>${zeilen(w)}</td><td><button type="button" class="knopf klein" data-kopier="${i}" title="Kopieren">📋</button></td></tr>`).join("")}</table></section>`
    : `<section class="karte"><h3>✉️ Vorschau der E-Mail an den Lieferanten</h3><p><b>Betreff:</b> ${esc(m.betreff)}</p><pre class="mailVorschau">${esc(m.text)}</pre></section>`}
    <section class="karte"><h3>🕓 Verlauf</h3><ul class="verlauf">${r.verlauf.slice().reverse().map(v => `<li><small>${new Date(v.zeit).toLocaleString("de-DE")}</small> ${esc(v.text)}</li>`).join("")}</ul>
      <button type="button" class="knopf gefahr klein" id="loeschen">🗑️ Löschen</button></section>`;
  $("zurueck").addEventListener("click", () => zeige("uebersicht"));
  $("bearbeiten").addEventListener("click", () => zeige("bearbeiten", r.id));
  $("mailOutlook")?.addEventListener("click", () => { if (r.status === "neu") { setzeStatus(r, "gemeldet", "E-Mail geöffnet"); setTimeout(zeichneDetail, 300); } });
  $("mailKopieren")?.addEventListener("click", () => kopiere(`${m.betreff}\n\n${m.text}`, "Betreff und Text"));
  const angaben = portalAngaben(r);
  if (l) {
    $("benutzerKopieren")?.addEventListener("click", () => kopiere(l.portalBenutzer, "Benutzer"));
    $("kwKopieren")?.addEventListener("click", () => kopiere(l.portalKennwort, "Kennwort"));
    $("kwAnsehen")?.addEventListener("click", () => { const a = $("kwAnzeige"); a.textContent = a.textContent.startsWith("•") ? l.portalKennwort : "••••••••"; });
  }
  $("portalKopieren")?.addEventListener("click", () => kopiere(angaben.map(([k, w]) => `${k}: ${w}`).join("\n"), "Alle Angaben"));
  for (const b of document.querySelectorAll("[data-kopier]")) b.addEventListener("click", () => { const [k, w] = angaben[b.dataset.kopier]; kopiere(w, k); });
  $("portalNrSpeichern")?.addEventListener("click", () => { r.portalNr = $("portalNr").value.trim(); r.verlauf.push({ zeit: new Date().toISOString(), text: `Vorgangsnr. im Portal: ${r.portalNr || "–"}` }); speichere(); meldung("💾 Vorgangsnummer gespeichert"); zeichneDetail(); });
  const auftragSpeichern = () => {
    const neu = $("auftragsNr").value.trim(); if (neu === (r.auftragsNr || "")) return;
    r.auftragsNr = neu; r.verlauf.push({ zeit: new Date().toISOString(), text: `Auftragsnr. des Lieferanten: ${neu || "–"}` });
    speichere(); meldung("💾 Auftragsnummer gespeichert"); zeichneDetail();
  };
  $("auftragsNrSpeichern")?.addEventListener("click", auftragSpeichern);
  $("auftragsNr")?.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); auftragSpeichern(); } });
  $("terminSpeichern")?.addEventListener("click", () => {
    const d = $("abholtermin").value; if (!d) return;
    r.abholtermin = d; setzeStatus(r, ablauf.indexOf(r.status) < ablauf.indexOf("abholung") ? "abholung" : r.status, `Abholung am ${datumDe(d)}`); meldung("📅 Abholtermin eingetragen"); zeichneDetail();
  });
  $("kvaJa")?.addEventListener("click", () => { r.kvaAntwort = "Kunde stimmt zu"; r.verlauf.push({ zeit: new Date().toISOString(), text: "KVA: Kunde stimmt zu" }); speichere(); meldung("👍 Vergiss nicht, dem Lieferanten die Freigabe zu schicken."); zeichneDetail(); });
  $("kvaNein")?.addEventListener("click", () => { r.kvaAntwort = "Kunde lehnt ab – Gerät unrepariert zurück"; r.verlauf.push({ zeit: new Date().toISOString(), text: "KVA: Kunde lehnt ab" }); speichere(); zeichneDetail(); });
  for (const b of document.querySelectorAll("[data-status]")) b.addEventListener("click", () => {
    let extra = "";
    if (b.dataset.status === "gemeldet" && $("portalNr")) { r.portalNr = $("portalNr").value.trim() || r.portalNr || ""; extra = r.portalNr ? `im Portal, Vorgangsnr. ${r.portalNr}` : "im Portal"; }
    if (b.dataset.status === "gutschrift") extra = r.gutschrift = $("gutschriftText")?.value.trim() || r.gutschrift || "";
    if (b.dataset.status === "kva") extra = r.kva = $("kvaText")?.value.trim() || r.kva || "";
    setzeStatus(r, b.dataset.status, extra); zeichneDetail();
  });
  $("statusWahl").addEventListener("change", e => { if (e.target.value) { setzeStatus(r, e.target.value); zeichneDetail(); } });
  $("dokNeu").addEventListener("change", async e => {
    const dateien = [...e.target.files]; if (!dateien.length) return;
    try { const n = await dateienHinzufuegen(r, dateien); if (n) meldung(`📎 ${n} Dokument${n > 1 ? "e" : ""} hinzugefügt`); }
    catch (err) { meldung("Speichern ging nicht – ist der Speicher voll?", "fehler"); }
    zeichneDetail();
  });
  for (const b of document.querySelectorAll("[data-dokauf]")) b.addEventListener("click", () => dateiOeffnen(b.dataset.dokauf));
  for (const b of document.querySelectorAll("[data-dokladen]")) b.addEventListener("click", () => dateiHerunterladen(b.dataset.dokladen));
  for (const b of document.querySelectorAll("[data-dokweg]")) b.addEventListener("click", async () => {
    const a = (r.anhaenge || []).find(x => x.id === b.dataset.dokweg);
    if (!a || !confirm(`„${a.name}“ löschen?`)) return;
    await dateiEntfernen(r, a.id); meldung("🗑️ Dokument gelöscht"); zeichneDetail();
  });
  $("loeschen").addEventListener("click", () => {
    if (!confirm(`${r.nummer} wirklich löschen?`)) return;
    dateienEntfernenVon(r); stand.reklamationen = stand.reklamationen.filter(x => x.id !== r.id); speichere(); meldung("🗑️ Gelöscht"); zeige("uebersicht");
  });
}

// ===================== LIEFERANTEN =====================
function zeichneLieferanten() {
  const l = bearbeiteLieferant === "neu" ? {} : bearbeiteLieferant ? lieferant(bearbeiteLieferant) : null;
  const anzahl = id => stand.reklamationen.filter(r => r.lieferant === id).length, offen = id => stand.reklamationen.filter(r => r.lieferant === id && istOffen(r)).length;
  $("inhalt").innerHTML = `<div class="leiste"><h2>🏭 Lieferanten</h2><button type="button" class="knopf haupt" id="lNeu">➕ Lieferant anlegen</button></div>
    ${l ? `<form id="lForm" class="formular karte">
      <h3 class="breit">${l.id ? `✏️ ${esc(l.name)}` : "➕ Neuer Lieferant"}</h3>
      <label>Name<input name="name" required value="${esc(l.name)}"></label>
      <label>Unsere Kundennummer dort<input name="kundennummer" value="${esc(l.kundennummer)}"></label>
      <fieldset class="breit meldeweg"><legend>Wie wird gemeldet?</legend>
        <label class="wahl"><input type="radio" name="meldeweg" value="email" ${istPortal(l) ? "" : "checked"}> ✉️ per E-Mail</label>
        <label class="wahl"><input type="radio" name="meldeweg" value="portal" ${istPortal(l) ? "checked" : ""}> 🌐 über ein Portal im Internet</label></fieldset>
      <label class="nurEmail">E-Mail für Reklamationen<input name="email" type="email" value="${esc(l.email)}" placeholder="reklamation@lieferant.de"></label>
      <label class="nurPortal">Adresse des Portals<input name="portalUrl" value="${esc(l.portalUrl)}" placeholder="z. B. service.lieferant.de/reklamation" inputmode="url" autocomplete="off"></label>
      <label class="nurPortal">Hinweis zum Portal<input name="portalHinweis" value="${esc(l.portalHinweis)}" placeholder="z. B. Login mit Kundennummer, Menü „Service → Reklamation“"></label>
      <label class="nurPortal">Benutzer<input name="portalBenutzer" value="${esc(l.portalBenutzer)}" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
      <label class="nurPortal">Kennwort<span class="kennwortZeile"><input name="portalKennwort" type="password" value="${esc(l.portalKennwort)}" autocomplete="new-password"><button type="button" class="knopf klein" id="kwZeigen" title="Kennwort zeigen">👁️</button></span></label>
      <small class="nurPortal breit warn">🔒 Benutzer und Kennwort werden unverschlüsselt auf diesem Gerät gespeichert und stehen auch in der Sicherungsdatei. Gib das Gerät und Sicherungen nicht weiter.</small>
      <label>Ansprechpartner<input name="ansprechpartner" value="${esc(l.ansprechpartner)}" placeholder="z. B. Frau Müller"></label>
      <label><span>Abholhinweis <small>(statt Standard)</small></span><input name="abholhinweis" value="${esc(l.abholhinweis)}" placeholder="z. B. Abholung nur Di/Do durch Spedition XY"></label>
      <details class="breit nurEmail" open><summary><b>📦 Vorlage für Retouren</b></summary>
        <label>Betreff<input name="betreff" value="${esc(l.betreff || STANDARD_BETREFF)}"></label>
        <label>Text<textarea name="vorlage" rows="12">${esc(l.vorlage || STANDARD_TEXT)}</textarea></label></details>
      <details class="breit nurEmail"><summary><b>🔧 Vorlage für Kunden-Reparaturen</b></summary>
        <label>Betreff<input name="betreffReparatur" value="${esc(l.betreffReparatur || STANDARD_REP_BETREFF)}"></label>
        <label>Text<textarea name="vorlageReparatur" rows="14">${esc(l.vorlageReparatur || STANDARD_REP_TEXT)}</textarea></label></details>
      <details class="breit nurEmail"><summary>Platzhalter, die automatisch ausgefüllt werden</summary><ul class="platzhalter">${PLATZHALTER.map(([p, t]) => `<li><code>${p}</code> ${t}</li>`).join("")}</ul></details>
      <div class="breit knoepfe"><button type="submit" class="knopf haupt">💾 Speichern</button><button type="button" class="knopf" id="lAbbrechen">Abbrechen</button>
        <button type="button" class="knopf nurEmail" id="lStandard">↺ Standard-Vorlagen</button>${l.id ? `<button type="button" class="knopf gefahr" id="lLoeschen">🗑️ Löschen</button>` : ""}</div>
    </form>` : ""}
    ${stand.lieferanten.length ? `<table class="tabelle"><thead><tr><th>Name</th><th>Meldeweg</th><th>Kd.-Nr.</th><th>Vorgänge</th><th></th></tr></thead><tbody>
      ${stand.lieferanten.slice().sort((a, b) => a.name.localeCompare(b.name)).map(x => `<tr><td><b>${esc(x.name)}</b>${x.ansprechpartner ? `<br><small>${esc(x.ansprechpartner)}</small>` : ""}</td><td>${istPortal(x) ? `🌐 ${esc(x.portalUrl || "Portal")}` : `✉️ ${esc(x.email || "–")}`}</td><td>${esc(x.kundennummer || "–")}</td>
        <td>${anzahl(x.id)}${offen(x.id) ? ` <small>(${offen(x.id)} offen)</small>` : ""}</td><td><button type="button" class="knopf klein" data-lbearb="${x.id}">✏️</button></td></tr>`).join("")}</tbody></table>`
      : !l ? `<p class="leer">Noch keine Lieferanten angelegt.</p>` : ""}`;
  beschrifteTabellen();
  $("lNeu").addEventListener("click", () => { bearbeiteLieferant = "neu"; zeichneLieferanten(); });
  for (const b of document.querySelectorAll("[data-lbearb]")) b.addEventListener("click", () => { bearbeiteLieferant = b.dataset.lbearb; zeichneLieferanten(); window.scrollTo(0, 0); });
  if (!l) return;
  const form = $("lForm");
  const zeigeMeldeweg = () => { const p = form.meldeweg.value === "portal"; form.classList.toggle("portalWeg", p); };
  for (const rb of form.querySelectorAll("[name=meldeweg]")) rb.addEventListener("change", zeigeMeldeweg);
  zeigeMeldeweg();
  $("kwZeigen").addEventListener("click", () => { const k = form.portalKennwort; k.type = k.type === "password" ? "text" : "password"; });
  $("lAbbrechen").addEventListener("click", () => { bearbeiteLieferant = null; zeichneLieferanten(); });
  $("lStandard").addEventListener("click", () => {
    form.betreff.value = STANDARD_BETREFF; form.vorlage.value = STANDARD_TEXT; form.betreffReparatur.value = STANDARD_REP_BETREFF; form.vorlageReparatur.value = STANDARD_REP_TEXT;
  });
  $("lLoeschen")?.addEventListener("click", () => {
    if (anzahl(l.id)) { meldung("Dieser Lieferant hat Vorgänge – er kann nicht gelöscht werden.", "fehler"); return; }
    if (!confirm(`${l.name} löschen?`)) return;
    stand.lieferanten = stand.lieferanten.filter(x => x.id !== l.id); speichere(); bearbeiteLieferant = null; zeichneLieferanten();
  });
  form.addEventListener("submit", e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target).entries());
    for (const k in f) f[k] = f[k].trim();
    if (l.id) Object.assign(l, f); else stand.lieferanten.push({ id: neueId(), ...f });
    speichere(); meldung(`💾 ${f.name} gespeichert`); bearbeiteLieferant = null; zeichneLieferanten();
  });
}

// ===================== EINSTELLUNGEN =====================
// Erledigte/abgelehnte/ausgegebene Vorgänge, die seit mindestens 3 Monaten abgeschlossen sind
function alteVorgaenge() {
  const grenze = new Date(); grenze.setMonth(grenze.getMonth() - 3);
  return stand.reklamationen.filter(r => !istOffen(r) && new Date(r.statusSeit || r.erstellt) <= grenze);
}
function zeichneEinstellungen() {
  const e = stand.einstellungen, alt = alteVorgaenge(), altDok = alt.reduce((n, r) => n + (r.anhaenge?.length || 0), 0);
  $("inhalt").innerHTML = `<h2>⚙️ Einstellungen</h2>
    <form id="eForm" class="formular karte">
      <label class="breit">Abholzeiten / Hinweis (Standard)<input name="abholhinweis" value="${esc(e.abholhinweis)}" placeholder="z. B. Abholung Mo–Fr 7–15 Uhr an Tor 3"></label>
      <label>Erinnern, wenn der Lieferant nach … Tagen nicht antwortet<input name="erinnerungTage" type="number" min="1" value="${esc(e.erinnerungTage)}"></label>
      <label>Erinnern, wenn eine Reparatur länger als … Tage dauert<input name="reparaturTage" type="number" min="1" value="${esc(e.reparaturTage)}"></label>
      <div class="breit knoepfe"><button type="submit" class="knopf haupt">💾 Speichern</button></div>
    </form>
    <section class="karte" id="kryptoKarte"><h3>🔒 Verschlüsselung</h3>
      ${verschluesselt() ? `<p class="kryptoAn">✅ <b>Eingeschaltet.</b> Alle Daten, PDFs und Sicherungen sind mit deinem Kennwort verschlüsselt. Beim Start und nach ${AUTO_SPERRE_MIN} Minuten ohne Benutzung fragt Retourix nach dem Kennwort.</p>
        <div class="knoepfe"><button type="button" class="knopf" id="jetztSperren">🔒 Jetzt sperren</button></div>
        <details><summary><b>Kennwort ändern</b></summary><form id="kwAendern" class="kwForm">
          <label>Bisheriges Kennwort<input type="password" name="alt" autocomplete="current-password" required></label>
          <label>Neues Kennwort<input type="password" name="neu" autocomplete="new-password" required minlength="${KENNWORT_MIN}"></label>
          <label>Neues Kennwort wiederholen<input type="password" name="neu2" autocomplete="new-password" required></label>
          <button type="submit" class="knopf haupt">🔑 Kennwort ändern</button></form></details>
        <details><summary><b>Verschlüsselung ausschalten</b></summary><form id="kwAus" class="kwForm">
          <label>Kennwort<input type="password" name="kw" autocomplete="current-password" required></label>
          <button type="submit" class="knopf gefahr">🔓 Verschlüsselung ausschalten</button></form></details>`
      : `<p>Verschlüsselt alle Daten auf diesem Gerät mit einem Kennwort: Retouren, Reparaturen, Lieferanten mit Portal-Zugängen, PDF-Dokumente und die Sicherungsdatei. Beim Start und nach ${AUTO_SPERRE_MIN} Minuten ohne Benutzung fragt Retourix dann nach dem Kennwort.</p>
        <p class="warn">⚠️ <b>Kennwort gut aufheben!</b> Wer es vergisst, kommt nie wieder an die Daten – auch nicht mit Hilfe.</p>
        <form id="kwEin" class="kwForm">
          <label>Kennwort <small>(mind. ${KENNWORT_MIN} Zeichen)</small><input type="password" name="neu" autocomplete="new-password" required minlength="${KENNWORT_MIN}"></label>
          <label>Kennwort wiederholen<input type="password" name="neu2" autocomplete="new-password" required></label>
          <button type="submit" class="knopf haupt">🔒 Verschlüsselung einschalten</button></form>`}</section>
    <section class="karte"><h3>🔄 Aktualisieren</h3>
      <p>Holt die neueste Version von Retourix. Deine Daten bleiben dabei erhalten.</p>
      <div class="knoepfe"><button type="button" class="knopf haupt" id="aktualisieren">🔄 Aktualisieren</button><small>Du hast <b>v${VERSION}</b></small></div></section>
    <section class="karte"><h3>🧹 Aufräumen</h3>
      <p>Löscht alle Retouren und Reparaturen, die seit mindestens <b>3 Monaten</b> erledigt, abgelehnt oder an den Kunden ausgegeben sind – mit allen ihren PDF-Dokumenten. Offene Vorgänge bleiben immer erhalten.</p>
      <div class="knoepfe"><button type="button" class="knopf gefahr" id="aufraeumen" ${alt.length ? "" : "disabled"}>🧹 ${alt.length ? `${alt.length} alte Vorgänge löschen` : "Nichts zum Aufräumen"}</button>
        ${alt.length ? `<small>${alt.length} Vorgänge${altDok ? ` · ${altDok} Dokument${altDok > 1 ? "e" : ""}` : ""}</small>` : ""}</div></section>
    <section class="karte"><h3>💾 Datensicherung</h3>
      <p>Alle Daten liegen nur hier im Browser auf diesem Gerät. Die Sicherung enthält auch die PDF-Dokumente${verschluesselt() ? " und ist mit deinem Kennwort verschlüsselt" : ""}. Speichere ab und zu eine Sicherung (z. B. auf dem Netzlaufwerk) – damit nichts verloren geht, falls der Browser-Speicher gelöscht wird.</p>
      <div class="knoepfe"><button type="button" class="knopf haupt" id="export">⬇️ Sicherung speichern</button><label class="knopf">⬆️ Sicherung laden<input type="file" id="import" accept=".json" hidden></label>
        <button type="button" class="knopf" id="csv">📊 Alles als Excel-Liste (CSV)</button></div>
      <small>${stand.reklamationen.length} Vorgänge · ${stand.lieferanten.length} Lieferanten${stand.letzteSicherung ? ` · letzte Sicherung: ${new Date(stand.letzteSicherung).toLocaleString("de-DE")}` : " · noch keine Sicherung gespeichert"}</small></section>
    <section class="karte"><h3>🔁 Automatische Sicherung</h3>
      ${!autoMoeglich() ? `<p>Auf diesem Gerät bzw. in diesem Browser nicht möglich (z. B. iPhone oder Firefox). Nutze hier „💾 Sicherung speichern“.</p>`
      : autoStatus === "aus" ? `<p>Retourix speichert jede Änderung automatisch in eine Datei deiner Wahl – z. B. auf dem USB-Stick oder einem Netzlaufwerk. ${verschluesselt() ? "Die Datei ist mit deinem Kennwort verschlüsselt." : "<b>Hinweis:</b> Ohne eingeschaltete Verschlüsselung stehen die Daten lesbar in der Datei."}</p>
          <button type="button" class="knopf haupt" id="autoEin">📁 Datei wählen und einschalten</button>`
      : autoStatus === "pausiert" ? `<p>⏸️ <b>Pausiert</b> – der Browser braucht deine Erlaubnis für „${esc(autoGriff?.name || "")}“.</p>
          <div class="knoepfe"><button type="button" class="knopf haupt" id="autoWeiter">▶️ Fortsetzen</button><button type="button" class="knopf" id="autoAus">Ausschalten</button></div>`
      : `<p class="kryptoAn">✅ Speichert automatisch in <b>${esc(autoGriff?.name || "")}</b>${autoZeit() ? ` · zuletzt: ${new Date(autoZeit()).toLocaleString("de-DE")}` : ""}</p>${autoFehler ? `<p class="warn">⚠️ ${esc(autoFehler)}</p>` : ""}
          <div class="knoepfe"><button type="button" class="knopf" id="autoJetzt">💾 Jetzt speichern</button><button type="button" class="knopf" id="autoAus">Ausschalten</button></div>`}
      <small class="leerKlein">Laden kannst du diese Datei wie jede Sicherung über „⬆️ Sicherung laden“.</small></section>
    <section class="karte gefahrZone"><h3>⚠️ Alle Daten löschen</h3>
      <p>Löscht <b>alles</b> auf diesem Gerät: alle Retouren und Reparaturen (auch offene), alle Lieferanten, alle PDF-Dokumente und die Einstellungen. Das geht nicht rückgängig – speichere vorher eine Sicherung, falls du die Daten noch brauchst.</p>
      <button type="button" class="knopf gefahr" id="allesLoeschen">🗑️ Alle Daten löschen</button></section>`;
  $("eForm").addEventListener("submit", ev => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.target).entries());
    Object.assign(stand.einstellungen, f, { erinnerungTage: Number(f.erinnerungTage) || 7, reparaturTage: Number(f.reparaturTage) || 21 });
    speichere(); meldung("💾 Einstellungen gespeichert"); zeichne();
  });
  $("aktualisieren").addEventListener("click", aktualisiere);
  // ----- Verschlüsselung -----
  const beschaeftigt = (form, an) => { for (const el of form.elements) el.disabled = an; };
  $("jetztSperren")?.addEventListener("click", sperren);
  $("kwEin")?.addEventListener("submit", async ev => {
    ev.preventDefault(); const f = ev.target;
    if (f.neu.value !== f.neu2.value) { meldung("Die beiden Kennwörter sind nicht gleich.", "fehler"); return; }
    if (!confirm("Verschlüsselung jetzt einschalten?\n\nOhne das Kennwort kommst du danach nie wieder an die Daten. Hast du es dir sicher notiert?")) return;
    beschaeftigt(f, true);
    try { await verschluesselungEin(f.neu.value); meldung("🔒 Verschlüsselung eingeschaltet"); }
    catch (e) { meldung("Das hat nicht geklappt – Daten sind unverändert.", "fehler"); }
    zeichneEinstellungen(); $("sperrKnopf").hidden = !verschluesselt();
  });
  $("kwAendern")?.addEventListener("submit", async ev => {
    ev.preventDefault(); const f = ev.target;
    if (f.neu.value !== f.neu2.value) { meldung("Die beiden neuen Kennwörter sind nicht gleich.", "fehler"); return; }
    beschaeftigt(f, true);
    try { await kennwortAendern(f.alt.value, f.neu.value); meldung("🔑 Kennwort geändert"); zeichneEinstellungen(); }
    catch (e) { beschaeftigt(f, false); meldung("Das bisherige Kennwort stimmt nicht.", "fehler"); }
  });
  $("kwAus")?.addEventListener("submit", async ev => {
    ev.preventDefault(); const f = ev.target;
    if (!confirm("Verschlüsselung ausschalten? Die Daten liegen danach wieder unverschlüsselt auf diesem Gerät.")) return;
    beschaeftigt(f, true);
    try { await verschluesselungAus(f.kw.value); meldung("🔓 Verschlüsselung ausgeschaltet"); zeichneEinstellungen(); $("sperrKnopf").hidden = true; }
    catch (e) { beschaeftigt(f, false); meldung("Das Kennwort stimmt nicht.", "fehler"); }
  });
  $("allesLoeschen").addEventListener("click", async () => {
    if (!confirm(`Wirklich ALLE Daten löschen?

${stand.reklamationen.length} Vorgänge, ${stand.lieferanten.length} Lieferanten, alle PDF-Dokumente und die Einstellungen werden endgültig gelöscht.`)) return;
    try { await dateiTx("readwrite", st => st.clear()); } catch (e) { /* kein Dokumentspeicher – egal */ }
    stand = leererStand(); speichere();
    meldung("🗑️ Alle Daten gelöscht"); zeige("uebersicht");
  });
  $("aufraeumen").addEventListener("click", async () => {
    const weg = alteVorgaenge(); if (!weg.length) return;
    const dok = weg.reduce((n, r) => n + (r.anhaenge?.length || 0), 0);
    if (!confirm(`${weg.length} Vorgänge${dok ? ` und ${dok} PDF-Dokument${dok > 1 ? "e" : ""}` : ""} endgültig löschen?\n\nTipp: Vorher eine Sicherung speichern, falls du sie später noch brauchst.`)) return;
    for (const r of weg) await dateienEntfernenVon(r);
    const ids = new Set(weg.map(r => r.id));
    stand.reklamationen = stand.reklamationen.filter(r => !ids.has(r.id)); speichere();
    meldung(`🧹 ${weg.length} alte Vorgänge gelöscht`); zeichneEinstellungen();
  });
  $("export").addEventListener("click", async () => { await sicherungJetzt(); zeichneEinstellungen(); });
  $("autoEin")?.addEventListener("click", async () => {
    try { await autoSicherungEinrichten(); meldung("💾 Automatische Sicherung eingeschaltet"); } catch (e) { if (e?.name !== "AbortError") meldung("Das ging nicht – bitte eine andere Datei wählen.", "fehler"); }
    zeichneEinstellungen();
  });
  $("autoJetzt")?.addEventListener("click", async () => { await autoSchreiben(); meldung(autoFehler || "💾 Gespeichert", autoFehler ? "fehler" : ""); zeichneEinstellungen(); });
  $("autoWeiter")?.addEventListener("click", async () => { await autoSicherungFortsetzen(); zeichneEinstellungen(); });
  $("autoAus")?.addEventListener("click", async () => { await autoSicherungAus(); meldung("Automatische Sicherung ausgeschaltet"); zeichneEinstellungen(); });
  $("import").addEventListener("change", async ev => {
    const datei = ev.target.files[0]; if (!datei) return;
    try {
      let d = JSON.parse(await datei.text());
      if (d.retourix === "verschluesselt") {
        const kw = await kennwortAbfrage("🔒 Verschlüsselte Sicherung", "Gib das Kennwort ein, mit dem diese Sicherung gespeichert wurde.");
        if (kw === null) { ev.target.value = ""; return; }
        try { d = JSON.parse((await paketOeffnen(d, kw)).text); } catch (e) { meldung("Das Kennwort passt nicht zu dieser Sicherung.", "fehler"); ev.target.value = ""; return; }
      }
      if (!Array.isArray(d.reklamationen) || !Array.isArray(d.lieferanten)) throw new Error();
      if (!confirm(`Sicherung laden? ${d.reklamationen.length} Vorgänge, ${d.lieferanten.length} Lieferanten${d.dateien?.length ? ` und ${d.dateien.length} Dokumente` : ""} – die jetzigen Daten werden ersetzt.`)) return;
      const { dateien, ...rest } = d;
      if (Array.isArray(dateien)) await dateienAusSicherung(dateien);
      stand = standAus(rest); speichere(); meldung("⬆️ Sicherung geladen"); zeige("uebersicht");
    } catch (e) { meldung("Das ist keine gültige Sicherungsdatei.", "fehler"); }
  });
  $("csv").addEventListener("click", () => {
    const kopf = ["Nummer", "Art", "Datum", "Lieferant", "Auftragsnr. Lieferant", "Retourennummer", "Reparaturnummer", "Kunde", "Telefon", "Lieferschein", "Seriennummer", "Artikel / Gerät", "Fehler", "Status", "Abholtermin", "Gutschrift", "KVA"];
    const z = [kopf].concat(stand.reklamationen.map(r => [r.nummer, ARTEN[artVon(r)].kurz, datumDe(r.datum), lieferant(r.lieferant)?.name || "", r.auftragsNr || "", r.retourennummer, r.reparaturnummer, r.kunde, r.kundeTelefon, r.lieferschein, r.seriennummer,
      (r.positionen || []).map(p => `${p.menge}x ${p.artikelnummer} ${p.bezeichnung}`).join(" | "), r.fehler, statusInfo(r.status).name, r.abholtermin ? datumDe(r.abholtermin) : "", r.gutschrift || "", r.kva || ""]));
    ladeHerunter(`reklamationen-${heute()}.csv`, "﻿" + z.map(x => x.map(w => `"${String(w ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n"), "text/csv");
  });
}
// Lädt alle Dateien frisch vom Server (am Browser-Zwischenspeicher vorbei) und startet die Seite neu
async function aktualisiere() {
  const knopf = $("aktualisieren");
  knopf.disabled = true; knopf.textContent = "⏳ Wird geprüft …";
  if (location.protocol === "file:") { location.reload(); return; }
  try {
    const t = await (await fetch("js/daten.js", { cache: "reload" })).text();
    const neu = (t.match(/VERSION = "([^"]+)"/) || [])[1];
    await Promise.all(["./", "index.html", "css/style.css", "js/daten.js", "js/krypto.js", "js/beispiel.js", "js/dateien.js", "js/sicherung.js", "js/auswertung.js", "js/app.js", "manifest.json"]
      .map(d => fetch(d, { cache: "reload" }).catch(() => null)));
    if (neu && neu !== VERSION) { meldung(`✨ Neue Version ${neu} wird geladen …`); setTimeout(() => location.reload(), 900); }
    else { meldung(`✅ Retourix ist aktuell (v${VERSION})`); knopf.disabled = false; knopf.textContent = "🔄 Aktualisieren"; }
  } catch (e) {
    meldung("Keine Verbindung – bitte später nochmal versuchen.", "fehler"); knopf.disabled = false; knopf.textContent = "🔄 Aktualisieren";
  }
}
// Kleine Kennwort-Abfrage (statt prompt, damit das Kennwort verdeckt bleibt). Ergebnis: Text oder null (Abbrechen)
function kennwortAbfrage(titel, text) {
  return new Promise(ok => {
    const box = document.createElement("div"); box.className = "dialogHinter";
    box.innerHTML = `<form class="dialog karte"><h3>${titel}</h3><p>${text}</p><input type="password" name="kw" autocomplete="current-password" required>
      <div class="knoepfe"><button type="submit" class="knopf haupt">OK</button><button type="button" class="knopf" data-abbrechen>Abbrechen</button></div></form>`;
    document.body.append(box);
    const f = box.querySelector("form"), fertig = w => { box.remove(); ok(w); };
    f.kw.focus();
    f.addEventListener("submit", e => { e.preventDefault(); fertig(f.kw.value); });
    box.querySelector("[data-abbrechen]").addEventListener("click", () => fertig(null));
  });
}
function zeigeSperre() {
  document.body.classList.add("gesperrt");
  const s = $("sperre"); s.hidden = false;
  s.innerHTML = `<form class="sperrKarte karte" id="sperrForm">${LOGO_SVG}<h2>Retourix ist gesperrt</h2>
    <p>Gib dein Kennwort ein.</p><input type="password" name="kw" autocomplete="current-password" required autofocus>
    <p class="sperrFehler" id="sperrFehler" hidden>❌ Falsches Kennwort.</p>
    <button type="submit" class="knopf haupt gross">🔓 Entsperren</button>
    <button type="button" class="vergessen" id="vergessen">Kennwort vergessen?</button></form>`;
  const f = $("sperrForm"); f.kw.focus();
  f.addEventListener("submit", async e => {
    e.preventDefault(); const knopf = f.querySelector("[type=submit]");
    knopf.disabled = true; knopf.textContent = "⏳ Prüfe …"; $("sperrFehler").hidden = true;
    try { await entsperren(f.kw.value); s.hidden = true; s.innerHTML = ""; losGehts(); }
    catch (err) { $("sperrFehler").hidden = false; knopf.disabled = false; knopf.textContent = "🔓 Entsperren"; f.kw.select(); }
  });
  $("vergessen").addEventListener("click", async () => {
    if (!confirm("Ohne Kennwort lassen sich die Daten nicht entschlüsseln.\n\nDu kannst Retourix nur zurücksetzen: Dabei werden ALLE Daten auf diesem Gerät gelöscht. Danach kannst du eine (unverschlüsselte oder mit bekanntem Kennwort gespeicherte) Sicherung laden.\n\nRetourix jetzt zurücksetzen?")) return;
    if (!confirm("Wirklich ALLES löschen? Das geht nicht rückgängig.")) return;
    localStorage.removeItem(TRESOR); localStorage.removeItem(SPEICHER);
    try { await dateiTx("readwrite", st => st.clear()); } catch (err) { /* egal */ }
    location.reload();
  });
}
function ladeHerunter(name, inhalt, typ) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([inhalt], { type: typ })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ===================== LOGO & START =====================
// Logo: Rückgabe-Pfeil im Kreis um ein „R“ (Retourix)
const LOGO_SVG = `<svg class="logo" viewBox="0 0 64 64" aria-hidden="true"><rect x="2" y="2" width="60" height="60" rx="14" fill="#d6001c"/>
  <path d="M47.3 19.1A20 20 0 1 1 16.7 19.1" stroke="#fff" stroke-width="4.5" fill="none" stroke-linecap="round"/><path d="M20.6 14.6L19.4 25.8L9.2 18.6Z" fill="#fff" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M25 44V22H33.5A6.5 6.5 0 0 1 33.5 35H25M32 35L39.5 44" stroke="#fff" stroke-width="4.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
function start() {
  document.querySelector(".markeIcon").outerHTML = LOGO_SVG;
  $("version").textContent = $("versionFuss").textContent = "v" + VERSION;
  { const j = new Date().getFullYear(); $("jahr").textContent = j > 2026 ? `2026–${j}` : "2026"; }
  document.title = `Retourix ${VERSION}`;
  const fav = document.createElement("link"); fav.rel = "icon"; fav.href = "data:image/svg+xml," + encodeURIComponent(LOGO_SVG.replace('class="logo" ', 'xmlns="http://www.w3.org/2000/svg" ')); document.head.append(fav);
  for (const b of document.querySelectorAll("#reiter button")) b.addEventListener("click", () => { bearbeiteLieferant = null; if (b.dataset.seite === "neu") neueArt = "artikel"; zeige(b.dataset.seite); });
  $("sperrKnopf").addEventListener("click", sperren);
  if (tresorVorhanden()) zeigeSperre();   // verschlüsselt -> erst Kennwort
  else { lade(); losGehts(); }
}
function losGehts() {
  for (const r of stand.reklamationen) if (!r.art) r.art = "artikel";   // ältere Einträge
  document.body.classList.remove("gesperrt");
  $("sperrKnopf").hidden = !verschluesselt();
  letzteAktivitaet = Date.now();
  zeichne();
  autoSicherungStart().then(() => { if (["uebersicht", "einstellungen"].includes(seite)) zeichne(); });
}
document.addEventListener("DOMContentLoaded", start);
