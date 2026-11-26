"use strict";
// © 2026 Stefan R. – Alle Rechte vorbehalten.
// =====================================================
//  BEISPIELDATEN – nur zum Vorführen. Alles erfunden.
//  Einstellungen → „Beispieldaten laden“ / „Alle Daten löschen“
// =====================================================

function ladeBeispieldaten() {
  const tag = n => new Date(Date.now() - n * 86400000).toISOString();
  const d = n => tag(n).slice(0, 10);
  const e = stand.einstellungen;
  if (!e.abholhinweis) e.abholhinweis = "Abholung Mo–Fr 7–15 Uhr an Tor 3";

  const L = [
    { id: "bsp-l1", name: "Beispiel Werkzeug GmbH", kundennummer: "KD-100234", email: "reklamation@example.com", cc: "", ansprechpartner: "Frau Schmidt", abholhinweis: "" },
    { id: "bsp-l2", name: "Muster Gartengeräte AG", kundennummer: "40-77812", email: "service@example.org", cc: "", ansprechpartner: "Herr Weber", abholhinweis: "Abholung durch Spedition, nur Di und Do" },
    { id: "bsp-l3", name: "Demo Farben & Lacke KG", kundennummer: "FL-5531", email: "retoure@example.net", cc: "", ansprechpartner: "", abholhinweis: "" },
  ];
  const verlauf = (...schritte) => schritte.map(([n, text]) => ({ zeit: tag(n), text }));
  const j = new Date().getFullYear();
  const R = [
    { id: "bsp-r1", art: "artikel", nummer: `R-${j}-0901`, datum: d(1), lieferant: "bsp-l1", retourennummer: "13300048211", lieferschein: "LS 884512",
      positionen: [{ artikelnummer: "4711001", bezeichnung: "Akku-Bohrschrauber 18 V", menge: 3 }], fehler: "Gehäuse bei Anlieferung gebrochen (Transportschaden).",
      pakete: 1, gewicht: "6", notiz: "", status: "neu", statusSeit: tag(1), erstellt: tag(1), verlauf: verlauf([1, "Erfasst"]) },
    { id: "bsp-r2", art: "artikel", nummer: `R-${j}-0902`, datum: d(12), lieferant: "bsp-l3", retourennummer: "13300048107", lieferschein: "RE 2024-5520",
      positionen: [{ artikelnummer: "5520300", bezeichnung: "Wandfarbe weiß 10 l", menge: 4 }, { artikelnummer: "5520310", bezeichnung: "Wandfarbe weiß 5 l", menge: 2 }],
      fehler: "Farbe klumpig, Charge 23-118.", pakete: 2, gewicht: "70", notiz: "Kundin hat Ersatz bekommen.", status: "gemeldet", statusSeit: tag(10), erstellt: tag(12),
      verlauf: verlauf([12, "Erfasst"], [10, "Status: Beim Lieferanten gemeldet – E-Mail geöffnet"]) },
    { id: "bsp-r3", art: "artikel", nummer: `R-${j}-0903`, datum: d(6), lieferant: "bsp-l2", retourennummer: "13300048156", lieferschein: "LS 77120",
      positionen: [{ artikelnummer: "6610045", bezeichnung: "Gartenschlauch 25 m", menge: 10 }], fehler: "Schläuche undicht an der Kupplung.",
      pakete: 1, gewicht: "18", notiz: "", status: "abholung", abholtermin: d(-2), statusSeit: tag(3), erstellt: tag(6),
      verlauf: verlauf([6, "Erfasst"], [5, "Status: Beim Lieferanten gemeldet – E-Mail geöffnet"], [3, `Status: Abholung geplant`]) },
    { id: "bsp-r4", art: "artikel", nummer: `R-${j}-0880`, datum: d(30), lieferant: "bsp-l1", retourennummer: "13300047730", lieferschein: "LS 870001",
      positionen: [{ artikelnummer: "4711230", bezeichnung: "Stichsäge 650 W", menge: 1 }], fehler: "Hubstange blockiert.",
      pakete: 1, gewicht: "3", notiz: "", status: "erledigt", gutschrift: "Gutschrift GS-55120, 59,99 €", statusSeit: tag(4), erstellt: tag(30),
      verlauf: verlauf([30, "Erfasst"], [29, "Status: Beim Lieferanten gemeldet"], [22, "Status: Abgeholt"], [6, "Status: Gutschrift / Ersatz erhalten – Gutschrift GS-55120, 59,99 €"], [4, "Status: Erledigt"]) },
    { id: "bsp-p1", art: "reparatur", nummer: "3681-104522-0001-01", reparaturnummer: "3681-104522-0001-01", datum: d(2), lieferant: "bsp-l2", kunde: "Herr Mustermann", kundeTelefon: "0170 0000001",
      positionen: [{ artikelnummer: "6620500", lieferantNr: "BRM-46S", ean: "4000000000017", bezeichnung: "Benzin-Rasenmäher 46 cm", menge: 1 }], seriennummer: "RM46-998812", kaufdatum: d(300),
      zubehoer: "Fangkorb", fehler: "Motor springt nicht an, Seilzug klemmt.",
      pakete: 1, gewicht: "28", notiz: "", status: "gemeldet", statusSeit: tag(2), erstellt: tag(2),
      verlauf: verlauf([2, "Erfasst"], [2, "Status: Beim Lieferanten gemeldet – E-Mail geöffnet"]) },
    { id: "bsp-p2", art: "reparatur", nummer: "3681-104377-0002-01", reparaturnummer: "3681-104377-0002-01", datum: d(18), lieferant: "bsp-l1", kunde: "Frau Musterfrau", kundeTelefon: "0151 0000002",
      positionen: [{ artikelnummer: "4711500", lieferantNr: "AKS-36-30", ean: "4000000000024", bezeichnung: "Akku-Kettensäge 36 V", menge: 1 }], seriennummer: "KS36-120455", kaufdatum: d(500),
      zubehoer: "2 Akkus, Ladegerät", fehler: "Kette läuft nicht mehr an.",
      pakete: 1, gewicht: "7", notiz: "", status: "kva", kva: "95 € – Motor tauschen", statusSeit: tag(3), erstellt: tag(18),
      verlauf: verlauf([18, "Erfasst"], [17, "Status: Beim Lieferanten gemeldet"], [12, "Status: Abgeholt"], [3, "Status: Kostenvoranschlag – 95 € – Motor tauschen"]) },
    { id: "bsp-p3", art: "reparatur", nummer: "3681-104201-0001-02", reparaturnummer: "3681-104201-0001-02", datum: d(26), lieferant: "bsp-l1", kunde: "Herr Beispielmann", kundeTelefon: "0160 0000003",
      positionen: [{ artikelnummer: "4711800", lieferantNr: "BH-800-K", ean: "4000000000031", bezeichnung: "Bohrhammer 800 W", menge: 1 }], seriennummer: "BH8-77310", kaufdatum: d(200),
      zubehoer: "Koffer", fehler: "Schlagwerk ohne Funktion.",
      pakete: 1, gewicht: "5", notiz: "", status: "zurueck", statusSeit: tag(2), erstellt: tag(26),
      verlauf: verlauf([26, "Erfasst"], [25, "Status: Beim Lieferanten gemeldet"], [20, "Status: Abgeholt"], [2, "Status: Zurück im Markt"]) },
  ];
  // vorhandene Beispiele ersetzen, echte Einträge bleiben
  stand.lieferanten = stand.lieferanten.filter(x => !x.id.startsWith("bsp-")).concat(L);
  stand.reklamationen = stand.reklamationen.filter(x => !x.id.startsWith("bsp-")).concat(R);
  speichere();
}
function loescheAlles() {
  stand = leererStand();
  speichere();
}
