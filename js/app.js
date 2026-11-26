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
     lieferanten: zeichneLieferanten, einstellungen: zeichneEinstellungen })[seite]();
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
    .filter(r => !suche || JSON.stringify([r.nummer, r.retourennummer, (r.positionen || []).map(p => [p.lieferantNr, p.ean]), r.kunde, r.kundeTelefon, r.lieferschein, r.seriennummer, r.fehler, r.positionen, lieferant(r.lieferant)?.name]).toLowerCase().includes(suche.toLowerCase()))
    .sort((a, b) => (b.erstellt || "").localeCompare(a.erstellt || ""));
  $("inhalt").innerHTML = `
    ${!stand.lieferanten.length ? `<div class="hinweisBox">👋 Willkommen! Lege zuerst unter <a href="#" data-geh="lieferanten">🏭 Lieferanten</a> deine Lieferanten an.<div class="knoepfe" style="margin-top:8px"><button type="button" class="knopf klein" id="bspLaden">🧪 Erst mal ausprobieren: Beispieldaten laden</button></div></div>` : ""}
    ${erin.length ? `<div class="hinweisBox warnung">⏰ <b>Bitte kümmern:</b><ul class="erinnerung">${erin.map(x => `<li><a href="#" data-detail="${x.r.id}">${ARTEN[artVon(x.r)].icon} ${esc(x.r.nummer)}</a> – ${esc(x.text)}</li>`).join("")}</ul></div>` : ""}
    <div class="neuKnoepfe">
      <button type="button" class="knopf haupt gross" data-geh="neu" data-art="artikel">📦 Neue Retoure <small>${offenAnz("artikel")} offen</small></button>
      <button type="button" class="knopf haupt gross blau" data-geh="neu" data-art="reparatur">🔧 Neuer Kunden-Reparaturauftrag <small>${offenAnz("reparatur")} offen</small></button>
    </div>
    <div class="kacheln">${sichtbareStatus.map(s => `<div class="kachel" style="--f:${s.farbe}"><span>${s.icon}</span><b>${zaehle(s.id)}</b><small>${s.name}</small></div>`).join("")}</div>
    <div class="leiste">
      <div class="filter">${[["alle", "Alle"], ["artikel", "📦 Retouren"], ["reparatur", "🔧 Reparaturen"]].map(([id, n]) => `<button type="button" data-artfilter="${id}" class="${artFilter === id ? "an" : ""}">${n}</button>`).join("")}</div>
      <div class="filter">${[["offen", "Offen"], ["fertig", "Erledigt"], ["alle", "Alle"]].map(([id, n]) => `<button type="button" data-filter="${id}" class="${filter === id ? "an" : ""}">${n}</button>`).join("")}</div>
      <input type="search" id="suche" placeholder="🔎 Suchen: Nummer, Kunde, Artikel, Seriennr., Lieferant …" value="${esc(suche)}">
    </div>
    ${liste.length ? `<table class="tabelle"><thead><tr><th>Nummer</th><th>Art</th><th>Datum</th><th>Lieferant</th><th>Artikel / Gerät</th><th>Kunde / Retourennr.</th><th>Status</th></tr></thead><tbody>
      ${liste.map(r => { const s = statusInfo(r.status), a = ARTEN[artVon(r)];
        return `<tr data-detail="${r.id}"><td><b>${esc(r.nummer)}</b></td><td title="${a.name}">${a.icon} ${a.kurz}</td><td>${datumDe(r.datum)}</td><td>${esc(lieferant(r.lieferant)?.name || "–")}</td>
          <td>${esc((r.positionen || []).map(p => `${p.menge}× ${p.bezeichnung}`).join(", ").slice(0, 60))}</td><td>${esc(artVon(r) === "reparatur" ? r.kunde : r.retourennummer || r.kunde)}</td>
          <td><span class="status" style="--f:${s.farbe}">${s.icon} ${s.name}</span>${erinIds.has(r.id) ? ` <span class="alt">⏰</span>` : ""}</td></tr>`; }).join("")}
    </tbody></table>` : `<p class="leer">${stand.reklamationen.length ? "Nichts in dieser Ansicht." : "Noch nichts erfasst."}</p>`}`;
  $("suche").addEventListener("input", e => { suche = e.target.value; const pos = e.target.selectionStart; zeichneUebersicht(); const s = $("suche"); s.focus(); s.setSelectionRange(pos, pos); });
  beschrifteTabellen();
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
      ${rep ? `<fieldset class="breit kundeBox"><legend>👤 Kunde <small>(bleibt intern)</small></legend>
          <label>Name<input name="kunde" value="${esc(r?.kunde)}" required></label>
          <label>Telefon<input name="kundeTelefon" value="${esc(r?.kundeTelefon)}"></label>
        </fieldset>`
        : `<label>Retourennummer<input name="retourennummer" value="${esc(r?.retourennummer)}" placeholder="z. B. 133xxxxxxxx" inputmode="numeric" autocomplete="off"></label>
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
    if (rep) Object.assign(daten, { kundeTelefon: w("kundeTelefon"), seriennummer: w("seriennummer"), kaufdatum: w("kaufdatum"), zubehoer: w("zubehoer") });
    let ziel = r;
    if (r) { Object.assign(r, daten); r.verlauf.push({ zeit: new Date().toISOString(), text: "Bearbeitet" }); }
    else {
      ziel = { id: neueId(), nummer: naechsteNummer(art), erstellt: new Date().toISOString(), status: "neu", statusSeit: new Date().toISOString(),
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
    "{lieferschein}": r.lieferschein || "–", "{retourennummer}": r.retourennummer || "–", "{fehler}": r.fehler || "–", "{pakete}": r.pakete || 1, "{gewicht}": r.gewicht || "–",
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
    case "gemeldet": return { titel: "Beim Lieferanten melden", html: `${m.an ? `<div class="knoepfe"><a class="knopf haupt" id="mailOutlook" href="${esc(mailtoLink(m))}">✉️ E-Mail in Outlook öffnen</a><button type="button" class="knopf" id="mailKopieren">📋 Text kopieren</button></div>
        <small>An: ${esc(m.an)}${m.cc ? ` · CC: ${esc(m.cc)}` : ""} · Fotos hängst du in Outlook an.</small>` : `<small class="warn">⚠️ Beim Lieferanten ist keine E-Mail-Adresse eingetragen.</small>`}
        ${r.status === "neu" ? `<button type="button" class="knopf klein" data-status="gemeldet">✔ Als gemeldet markieren</button>` : ""}` };
    case "abholung": return { titel: "Abholung vorbereiten", html: `<div class="zeile"><label>Abholtermin <input type="date" id="abholtermin" value="${esc(r.abholtermin || "")}"></label><button type="button" class="knopf klein" id="terminSpeichern">📅 Termin eintragen</button></div>` };
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
        <dt>Datum</dt><dd>${datumDe(r.datum)}</dd><dt>Lieferant</dt><dd>${esc(l?.name || "–")}</dd>${rep ? `<dt>Kunde</dt><dd>${esc(r.kunde || "–")}</dd>` : `<dt>Retourennummer</dt><dd>${esc(r.retourennummer || "–")}</dd>${r.kunde ? `<dt>Kunde</dt><dd>${esc(r.kunde)}</dd>` : ""}`}
        ${rep ? `<dt>Telefon</dt><dd>${esc(r.kundeTelefon || "–")}</dd>${r.kundeEmail ? `<dt>E-Mail</dt><dd>${esc(r.kundeEmail)}</dd>` : ""}
          ${(g => `<dt>Gerät</dt><dd>${esc(g.bezeichnung || "–")}</dd><dt>Unsere Art.-Nr.</dt><dd>${esc(g.artikelnummer || "–")}</dd>
          <dt>Ihre Art.-Nr.</dt><dd>${esc(g.lieferantNr || "–")}</dd><dt>EAN</dt><dd>${esc(g.ean || "–")}</dd>`)((r.positionen || [])[0] || {})}
          <dt>Seriennummer</dt><dd>${esc(r.seriennummer || "–")}</dd><dt>Kaufdatum</dt><dd>${r.kaufdatum ? datumDe(r.kaufdatum) : "–"}</dd><dt>Zubehör</dt><dd>${esc(r.zubehoer || "keins")}</dd>
          ${r.kva ? `<dt>Kosten&shy;voranschlag</dt><dd>${esc(r.kva)}${r.kvaAntwort ? ` – ${esc(r.kvaAntwort)}` : ""}</dd>` : ""}`
        : `<dt>Lieferschein</dt><dd>${esc(r.lieferschein || "–")}</dd>`}
        <dt>Pakete / Gewicht</dt><dd>${esc(r.pakete || 1)} / ${esc(r.gewicht || "–")} kg</dd>
        ${r.abholtermin ? `<dt>Abholtermin</dt><dd><b>${datumDe(r.abholtermin)}</b></dd>` : ""}${r.gutschrift ? `<dt>Gutschrift</dt><dd>${esc(r.gutschrift)}</dd>` : ""}</dl>
        ${rep ? "" : `<table class="tabelle klein"><thead><tr><th>Artikelnr.</th><th>Bezeichnung</th><th>Menge</th></tr></thead><tbody>${(r.positionen || []).map(p => `<tr><td>${esc(p.artikelnummer)}</td><td>${esc(p.bezeichnung)}</td><td>${esc(p.menge)}</td></tr>`).join("")}</tbody></table>`}
        <p class="fehlerText"><b>Fehler:</b> ${zeilen(r.fehler)}</p>${r.notiz ? `<p class="notiz">📝 ${zeilen(r.notiz)}</p>` : ""}</section>
      <section class="karte"><h3>⚡ Nächste Schritte</h3>${schritte}
        <div class="knoepfe unten">${!FERTIG.includes(r.status) ? `<button type="button" class="knopf" data-status="${rep ? "ausgegeben" : "erledigt"}">✅ ${rep ? "Abgeschlossen" : "Erledigt"}</button>` : ""}${r.status !== "abgelehnt" ? `<button type="button" class="knopf gefahr" data-status="abgelehnt">⛔ Abgelehnt</button>` : ""}
          <select id="statusWahl"><option value="">Status direkt setzen …</option>${STATUS.filter(x => ablauf.includes(x.id) || ["abgelehnt", "erledigt"].includes(x.id)).map(x => `<option value="${x.id}">${x.icon} ${x.name}</option>`).join("")}</select></div>
      </section>
    </div>
    <section class="karte"><h3>✉️ Vorschau der E-Mail an den Lieferanten</h3><p><b>Betreff:</b> ${esc(m.betreff)}</p><pre class="mailVorschau">${esc(m.text)}</pre></section>
    <section class="karte"><h3>🕓 Verlauf</h3><ul class="verlauf">${r.verlauf.slice().reverse().map(v => `<li><small>${new Date(v.zeit).toLocaleString("de-DE")}</small> ${esc(v.text)}</li>`).join("")}</ul>
      <button type="button" class="knopf gefahr klein" id="loeschen">🗑️ Löschen</button></section>`;
  $("zurueck").addEventListener("click", () => zeige("uebersicht"));
  $("bearbeiten").addEventListener("click", () => zeige("bearbeiten", r.id));
  $("mailOutlook")?.addEventListener("click", () => { if (r.status === "neu") { setzeStatus(r, "gemeldet", "E-Mail geöffnet"); setTimeout(zeichneDetail, 300); } });
  $("mailKopieren")?.addEventListener("click", () => kopiere(`${m.betreff}\n\n${m.text}`, "Betreff und Text"));
  $("terminSpeichern")?.addEventListener("click", () => {
    const d = $("abholtermin").value; if (!d) return;
    r.abholtermin = d; setzeStatus(r, ablauf.indexOf(r.status) < ablauf.indexOf("abholung") ? "abholung" : r.status, `Abholung am ${datumDe(d)}`); meldung("📅 Abholtermin eingetragen"); zeichneDetail();
  });
  $("kvaJa")?.addEventListener("click", () => { r.kvaAntwort = "Kunde stimmt zu"; r.verlauf.push({ zeit: new Date().toISOString(), text: "KVA: Kunde stimmt zu" }); speichere(); meldung("👍 Vergiss nicht, dem Lieferanten die Freigabe zu schicken."); zeichneDetail(); });
  $("kvaNein")?.addEventListener("click", () => { r.kvaAntwort = "Kunde lehnt ab – Gerät unrepariert zurück"; r.verlauf.push({ zeit: new Date().toISOString(), text: "KVA: Kunde lehnt ab" }); speichere(); zeichneDetail(); });
  for (const b of document.querySelectorAll("[data-status]")) b.addEventListener("click", () => {
    let extra = "";
    if (b.dataset.status === "gutschrift") extra = r.gutschrift = $("gutschriftText")?.value.trim() || r.gutschrift || "";
    if (b.dataset.status === "kva") extra = r.kva = $("kvaText")?.value.trim() || r.kva || "";
    setzeStatus(r, b.dataset.status, extra); zeichneDetail();
  });
  $("statusWahl").addEventListener("change", e => { if (e.target.value) { setzeStatus(r, e.target.value); zeichneDetail(); } });
  $("loeschen").addEventListener("click", () => {
    if (!confirm(`${r.nummer} wirklich löschen?`)) return;
    stand.reklamationen = stand.reklamationen.filter(x => x.id !== r.id); speichere(); meldung("🗑️ Gelöscht"); zeige("uebersicht");
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
      <label>E-Mail für Reklamationen<input name="email" type="email" value="${esc(l.email)}" placeholder="reklamation@lieferant.de"></label>
      <label>Ansprechpartner<input name="ansprechpartner" value="${esc(l.ansprechpartner)}" placeholder="z. B. Frau Müller"></label>
      <label>Abholhinweis <small>(statt Standard)</small><input name="abholhinweis" value="${esc(l.abholhinweis)}" placeholder="z. B. Abholung nur Di/Do durch Spedition XY"></label>
      <details class="breit" open><summary><b>📦 Vorlage für Retouren</b></summary>
        <label>Betreff<input name="betreff" value="${esc(l.betreff || STANDARD_BETREFF)}"></label>
        <label>Text<textarea name="vorlage" rows="12">${esc(l.vorlage || STANDARD_TEXT)}</textarea></label></details>
      <details class="breit"><summary><b>🔧 Vorlage für Kunden-Reparaturen</b></summary>
        <label>Betreff<input name="betreffReparatur" value="${esc(l.betreffReparatur || STANDARD_REP_BETREFF)}"></label>
        <label>Text<textarea name="vorlageReparatur" rows="14">${esc(l.vorlageReparatur || STANDARD_REP_TEXT)}</textarea></label></details>
      <details class="breit"><summary>Platzhalter, die automatisch ausgefüllt werden</summary><ul class="platzhalter">${PLATZHALTER.map(([p, t]) => `<li><code>${p}</code> ${t}</li>`).join("")}</ul></details>
      <div class="breit knoepfe"><button type="submit" class="knopf haupt">💾 Speichern</button><button type="button" class="knopf" id="lAbbrechen">Abbrechen</button>
        <button type="button" class="knopf" id="lStandard">↺ Standard-Vorlagen</button>${l.id ? `<button type="button" class="knopf gefahr" id="lLoeschen">🗑️ Löschen</button>` : ""}</div>
    </form>` : ""}
    ${stand.lieferanten.length ? `<table class="tabelle"><thead><tr><th>Name</th><th>E-Mail</th><th>Kd.-Nr.</th><th>Vorgänge</th><th></th></tr></thead><tbody>
      ${stand.lieferanten.slice().sort((a, b) => a.name.localeCompare(b.name)).map(x => `<tr><td><b>${esc(x.name)}</b>${x.ansprechpartner ? `<br><small>${esc(x.ansprechpartner)}</small>` : ""}</td><td>${esc(x.email || "–")}</td><td>${esc(x.kundennummer || "–")}</td>
        <td>${anzahl(x.id)}${offen(x.id) ? ` <small>(${offen(x.id)} offen)</small>` : ""}</td><td><button type="button" class="knopf klein" data-lbearb="${x.id}">✏️</button></td></tr>`).join("")}</tbody></table>`
      : !l ? `<p class="leer">Noch keine Lieferanten angelegt.</p>` : ""}`;
  beschrifteTabellen();
  $("lNeu").addEventListener("click", () => { bearbeiteLieferant = "neu"; zeichneLieferanten(); });
  for (const b of document.querySelectorAll("[data-lbearb]")) b.addEventListener("click", () => { bearbeiteLieferant = b.dataset.lbearb; zeichneLieferanten(); window.scrollTo(0, 0); });
  if (!l) return;
  const form = $("lForm");
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
function zeichneEinstellungen() {
  const e = stand.einstellungen;
  $("inhalt").innerHTML = `<h2>⚙️ Einstellungen</h2>
    <form id="eForm" class="formular karte">
      <label class="breit">Abholzeiten / Hinweis (Standard)<input name="abholhinweis" value="${esc(e.abholhinweis)}" placeholder="z. B. Abholung Mo–Fr 7–15 Uhr an Tor 3"></label>
      <label>Erinnern, wenn der Lieferant nach … Tagen nicht antwortet<input name="erinnerungTage" type="number" min="1" value="${esc(e.erinnerungTage)}"></label>
      <label>Erinnern, wenn eine Reparatur länger als … Tage dauert<input name="reparaturTage" type="number" min="1" value="${esc(e.reparaturTage)}"></label>
      <label>Kürzel Retoure<input name="praefix" value="${esc(e.praefix)}" maxlength="6"></label>
      <label>Kürzel Reparaturauftrag<input name="praefixReparatur" value="${esc(e.praefixReparatur)}" maxlength="6"></label>
      <div class="breit knoepfe"><button type="submit" class="knopf haupt">💾 Speichern</button></div>
    </form>
    <section class="karte"><h3>🔄 Aktualisieren</h3>
      <p>Holt die neueste Version von Retourix. Deine Daten bleiben dabei erhalten.</p>
      <div class="knoepfe"><button type="button" class="knopf haupt" id="aktualisieren">🔄 Aktualisieren</button><small>Du hast <b>v${VERSION}</b></small></div></section>
    <section class="karte"><h3>💾 Datensicherung</h3>
      <p>Alle Daten liegen nur hier im Browser auf diesem Gerät. Speichere ab und zu eine Sicherung (z. B. auf dem Netzlaufwerk) – damit nichts verloren geht, falls der Browser-Speicher gelöscht wird.</p>
      <div class="knoepfe"><button type="button" class="knopf haupt" id="export">⬇️ Sicherung speichern</button><label class="knopf">⬆️ Sicherung laden<input type="file" id="import" accept=".json" hidden></label>
        <button type="button" class="knopf" id="csv">📊 Alles als Excel-Liste (CSV)</button></div>
      <small>${stand.reklamationen.length} Vorgänge · ${stand.lieferanten.length} Lieferanten${stand.letzteSicherung ? ` · letzte Sicherung: ${new Date(stand.letzteSicherung).toLocaleString("de-DE")}` : " · noch keine Sicherung gespeichert"}</small></section>`;
  $("eForm").addEventListener("submit", ev => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.target).entries());
    Object.assign(stand.einstellungen, f, { erinnerungTage: Number(f.erinnerungTage) || 7, reparaturTage: Number(f.reparaturTage) || 21 });
    speichere(); meldung("💾 Einstellungen gespeichert"); zeichne();
  });
  $("aktualisieren").addEventListener("click", aktualisiere);
  $("export").addEventListener("click", () => {
    stand.letzteSicherung = new Date().toISOString(); speichere();
    ladeHerunter(`reklamationen-sicherung-${heute()}.json`, JSON.stringify(stand, null, 1), "application/json"); zeichneEinstellungen();
  });
  $("import").addEventListener("change", async ev => {
    const datei = ev.target.files[0]; if (!datei) return;
    try {
      const d = JSON.parse(await datei.text());
      if (!Array.isArray(d.reklamationen) || !Array.isArray(d.lieferanten)) throw new Error();
      if (!confirm(`Sicherung laden? ${d.reklamationen.length} Vorgänge und ${d.lieferanten.length} Lieferanten – die jetzigen Daten werden ersetzt.`)) return;
      stand = { ...leererStand(), ...d, einstellungen: { ...leererStand().einstellungen, ...(d.einstellungen || {}) } }; speichere(); meldung("⬆️ Sicherung geladen"); zeige("uebersicht");
    } catch (e) { meldung("Das ist keine gültige Sicherungsdatei.", "fehler"); }
  });
  $("csv").addEventListener("click", () => {
    const kopf = ["Nummer", "Art", "Datum", "Lieferant", "Retourennummer", "Kunde", "Telefon", "Lieferschein", "Seriennummer", "Artikel / Gerät", "Fehler", "Status", "Abholtermin", "Gutschrift", "KVA"];
    const z = [kopf].concat(stand.reklamationen.map(r => [r.nummer, ARTEN[artVon(r)].kurz, datumDe(r.datum), lieferant(r.lieferant)?.name || "", r.retourennummer, r.kunde, r.kundeTelefon, r.lieferschein, r.seriennummer,
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
    await Promise.all(["./", "index.html", "css/style.css", "js/daten.js", "js/beispiel.js", "js/app.js", "manifest.json"]
      .map(d => fetch(d, { cache: "reload" }).catch(() => null)));
    if (neu && neu !== VERSION) { meldung(`✨ Neue Version ${neu} wird geladen …`); setTimeout(() => location.reload(), 900); }
    else { meldung(`✅ Retourix ist aktuell (v${VERSION})`); knopf.disabled = false; knopf.textContent = "🔄 Aktualisieren"; }
  } catch (e) {
    meldung("Keine Verbindung – bitte später nochmal versuchen.", "fehler"); knopf.disabled = false; knopf.textContent = "🔄 Aktualisieren";
  }
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
  lade();
  for (const r of stand.reklamationen) if (!r.art) r.art = "artikel";   // ältere Einträge
  document.querySelector(".markeIcon").outerHTML = LOGO_SVG;
  $("version").textContent = $("versionFuss").textContent = "v" + VERSION;
  { const j = new Date().getFullYear(); $("jahr").textContent = j > 2026 ? `2026–${j}` : "2026"; }
  document.title = `Retourix ${VERSION}`;
  const fav = document.createElement("link"); fav.rel = "icon"; fav.href = "data:image/svg+xml," + encodeURIComponent(LOGO_SVG.replace('class="logo" ', 'xmlns="http://www.w3.org/2000/svg" ')); document.head.append(fav);
  for (const b of document.querySelectorAll("#reiter button")) b.addEventListener("click", () => { bearbeiteLieferant = null; if (b.dataset.seite === "neu") neueArt = "artikel"; zeige(b.dataset.seite); });
  zeichne();
}
document.addEventListener("DOMContentLoaded", start);
