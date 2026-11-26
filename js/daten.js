"use strict";
// =====================================================
//  DATEN – alles bleibt im Browser auf diesem PC (localStorage).
//  Nichts wird ins Internet geschickt. Sicherung: Einstellungen → Daten speichern / laden.
// =====================================================

const VERSION = "1.9";   // 1.0 Start · 1.1 zwei Arten · 1.2 Name Retourix · 1.3 neues Logo + Versionsanzeige · 1.4 Handy-Ansicht, Beispieldaten, App-Symbol · 1.5 Link unten · 1.6 QR-Code in den Einstellungen · 1.7 Kundenbeleg entfernt · 1.8 Kunde benachrichtigen entfernt · 1.9 Aktualisieren-Knopf
const SPEICHER = "reklamation-daten-v1";

// Zwei Arten: Artikel-Reklamation (Ware zurück an den Lieferanten) und Kunden-Reparaturauftrag (Gerät geht zur Reparatur und zurück zum Kunden)
const ARTEN = {
  artikel:   { name: "Artikel-Reklamation", kurz: "Artikel",   icon: "📦", praefix: "praefix" },
  reparatur: { name: "Kunden-Reparatur",    kurz: "Reparatur", icon: "🔧", praefix: "praefixReparatur" },
};
// Alle Status (Farbe für die Anzeige)
const STATUS = [
  { id: "neu",        name: "Neu",                          icon: "🆕", farbe: "#6b7280" },
  { id: "gemeldet",   name: "Beim Lieferanten gemeldet",    icon: "✉️", farbe: "#2563eb" },
  { id: "abholung",   name: "Abholung geplant",             icon: "📅", farbe: "#7c3aed" },
  { id: "abgeholt",   name: "Abgeholt",                     icon: "🚚", farbe: "#d97706" },
  { id: "kva",        name: "Kosten­voranschlag",       icon: "🧾", farbe: "#db2777" },
  { id: "zurueck",    name: "Zurück im Markt",              icon: "📥", farbe: "#0891b2" },
  { id: "kunde_info", name: "Kunde benachrichtigt",         icon: "📞", farbe: "#4f46e5" },   // nur noch für alte Einträge
  { id: "gutschrift", name: "Gutschrift / Ersatz erhalten", icon: "💶", farbe: "#059669" },
  { id: "ausgegeben", name: "An Kunden ausgegeben",         icon: "🤝", farbe: "#047857" },
  { id: "erledigt",   name: "Erledigt",                     icon: "✅", farbe: "#047857" },
  { id: "abgelehnt",  name: "Abgelehnt",                    icon: "⛔", farbe: "#dc2626" },
];
// Ablauf je Art (Reihenfolge der Schritte)
const ABLAUF = {
  artikel:   ["neu", "gemeldet", "abholung", "abgeholt", "gutschrift", "erledigt"],
  reparatur: ["neu", "gemeldet", "abholung", "abgeholt", "kva", "zurueck", "ausgegeben"],
};
const FERTIG = ["erledigt", "abgelehnt", "ausgegeben"];
const istOffen = r => !FERTIG.includes(r.status);
const GARANTIE = ["Garantie / Gewährleistung", "Kulanz", "Kostenpflichtig"];

// Platzhalter für die E-Mail-Vorlagen
const PLATZHALTER = [
  ["{nummer}", "Reklamationsnummer"], ["{datum}", "Datum der Reklamation"], ["{kundennummer}", "Unsere Kundennummer beim Lieferanten"],
  ["{anrede}", "Anrede (Sehr geehrte Frau …/Herr … oder Damen und Herren)"], ["{positionen}", "Liste aller Artikel mit Menge"],
  ["{lieferschein}", "Lieferschein-/Rechnungsnummer"], ["{fehler}", "Fehlerbeschreibung"], ["{pakete}", "Anzahl Pakete"],
  ["{gewicht}", "Gewicht in kg"], ["{abholadresse}", "Abholadresse"], ["{abholhinweis}", "Abholzeiten / Hinweise"],
  ["{name}", "Dein Name"], ["{firma}", "Firmenname"], ["{telefon}", "Deine Telefonnummer"], ["{email}", "Deine E-Mail-Adresse"],
  ["{geraet}", "Reparatur: Gerät (Artikelnr. und Bezeichnung)"], ["{seriennummer}", "Reparatur: Seriennummer"], ["{kaufdatum}", "Reparatur: Kaufdatum"],
  ["{beleg}", "Reparatur: Kassenbon / Rechnung"], ["{garantie}", "Reparatur: Garantie / Kulanz / kostenpflichtig"], ["{kostenlimit}", "Reparatur: Kostenlimit"],
  ["{zubehoer}", "Reparatur: mitgegebenes Zubehör"], ["{kundenname}", "Name des Kunden (nur wenn du ihn mitschicken willst)"],
];

const STANDARD_BETREFF = "Reklamation {nummer} – Kd.-Nr. {kundennummer}";
const STANDARD_TEXT = `{anrede},

hiermit melden wir folgende Reklamation an:

Reklamationsnummer: {nummer}
Unsere Kundennummer: {kundennummer}
Lieferschein / Rechnung: {lieferschein}

Artikel:
{positionen}

Fehlerbeschreibung:
{fehler}

Die Ware steht zur Abholung bereit ({pakete} Paket(e), ca. {gewicht} kg):
{abholadresse}
{abholhinweis}

Bitte bestätigen Sie uns die Reklamation und teilen Sie uns den Abholtermin mit.

Mit freundlichen Grüßen
{name}
{firma}
Tel. {telefon}
{email}`;

const STANDARD_REP_BETREFF = "Reparaturauftrag {nummer} – Kd.-Nr. {kundennummer}";
const STANDARD_REP_TEXT = `{anrede},

wir senden Ihnen folgendes Kundengerät zur Reparatur:

Auftragsnummer: {nummer}
Unsere Kundennummer: {kundennummer}

Gerät: {geraet}
Seriennummer: {seriennummer}
Kaufdatum: {kaufdatum} (Beleg: {beleg})
Abrechnung: {garantie}
Kostenlimit: {kostenlimit} – bei höheren Kosten bitte vorher einen Kostenvoranschlag
Mitgegebenes Zubehör: {zubehoer}

Fehlerbeschreibung:
{fehler}

Das Gerät steht zur Abholung bereit ({pakete} Paket(e), ca. {gewicht} kg):
{abholadresse}
{abholhinweis}

Bitte senden Sie das Gerät nach der Reparatur an die obige Adresse zurück und geben Sie dabei unsere Auftragsnummer {nummer} an.

Mit freundlichen Grüßen
{name}
{firma}
Tel. {telefon}
{email}`;

function leererStand() {
  return {
    version: 1, zaehler: {},   // Jahr -> laufende Nummer
    einstellungen: { firma: "", name: "", telefon: "", email: "", abholadresse: "", abholhinweis: "", erinnerungTage: 7, reparaturTage: 21, praefix: "R", praefixReparatur: "RP" },
    lieferanten: [], reklamationen: [],
  };
}
let stand = leererStand();

function lade() {
  try {
    const d = JSON.parse(localStorage.getItem(SPEICHER) || "null");
    if (d && typeof d === "object") stand = { ...leererStand(), ...d, einstellungen: { ...leererStand().einstellungen, ...(d.einstellungen || {}) } };
  } catch (e) { /* kaputt -> leer anfangen */ }
}
function speichere() {
  try { localStorage.setItem(SPEICHER, JSON.stringify(stand)); return true; }
  catch (e) { meldung("⚠️ Speichern ging nicht – ist der Speicher voll?", "fehler"); return false; }
}

const neueId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function naechsteNummer(art = "artikel") {
  const j = new Date().getFullYear(), k = art === "reparatur" ? `${j}-rep` : j;
  stand.zaehler[k] = (stand.zaehler[k] || 0) + 1;
  const praefix = stand.einstellungen[ARTEN[art].praefix] || (art === "reparatur" ? "RP" : "R");
  return `${praefix}-${j}-${String(stand.zaehler[k]).padStart(4, "0")}`;
}
const lieferant = id => stand.lieferanten.find(l => l.id === id) || null;
const reklamation = id => stand.reklamationen.find(r => r.id === id) || null;
const statusInfo = id => STATUS.find(s => s.id === id) || STATUS[0];
