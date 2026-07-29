// src/data/mock.js
// Mock-Daten — Vanessa Müller, August 2026, Gruppe Bären
// Alle date-Felder: YYYY-MM-DD
// Alle createdAt/reviewedAt-Felder: ISO 8601 mit Zeitzone

// ============================================================
// User
// ============================================================

/** @type {{ id: string, displayName: string, email: string, group: string, role: string }} */
export const MOCK_USER = {
  id: "user-001",
  displayName: "Vanessa Müller",
  email: "vanessa.mueller@kita-villakunterbunt.de",
  group: "Bären",
  role: "mitarbeiterin",
};

// ============================================================
// Colleagues — andere Mitarbeiterinnen
// ============================================================

export const MOCK_COLLEAGUES = [
  { id: "user-002", displayName: "Lisa Bauer",   group: "Mäuse", role: "mitarbeiterin" },
  { id: "user-003", displayName: "Sarah Klein",  group: "Dinos",  role: "mitarbeiterin" },
  { id: "user-004", displayName: "Mia Wagner",   group: "Bären",  role: "mitarbeiterin" },
];

// ============================================================
// Shifts — 20 Dienste August 2026 (Mo–Fr, 4 Wochen)
// Typen: "frueh" | "spaet" | "teil" | "frei" | "urlaub" | "krank"
// Sa/So werden NICHT eingetragen — Kita hat keinen Wochenenddienst.
// ============================================================

/** @type {Array<{id:string, userId:string, date:string, type:string, startTime:string|null, endTime:string|null, group:string, room:string|null, note:string|null}>} */
export const MOCK_SHIFTS = [
  // ----- Woche 1: 3.–7. August -----
  { id: "s01", userId: "user-001", date: "2026-08-03", type: "frueh", startTime: "07:00", endTime: "14:00", group: "Bären", room: "Raum 2", note: null },
  { id: "s02", userId: "user-001", date: "2026-08-04", type: "spaet", startTime: "12:00", endTime: "19:00", group: "Bären", room: "Raum 2", note: null },
  { id: "s03", userId: "user-001", date: "2026-08-05", type: "frueh", startTime: "07:00", endTime: "14:00", group: "Bären", room: "Raum 1", note: "Elterngespräch 13:00" },
  { id: "s04", userId: "user-001", date: "2026-08-06", type: "frei",  startTime: null,    endTime: null,    group: "Bären", room: null,     note: null },
  { id: "s05", userId: "user-001", date: "2026-08-07", type: "spaet", startTime: "12:00", endTime: "19:00", group: "Bären", room: "Raum 2", note: null },

  // ----- Woche 2: 10.–14. August -----
  { id: "s06", userId: "user-001", date: "2026-08-10", type: "spaet", startTime: "12:00", endTime: "19:00", group: "Bären", room: "Raum 2", note: null },
  { id: "s07", userId: "user-001", date: "2026-08-11", type: "frueh", startTime: "07:00", endTime: "14:00", group: "Bären", room: "Raum 2", note: null },
  { id: "s08", userId: "user-001", date: "2026-08-12", type: "frueh", startTime: "07:00", endTime: "14:00", group: "Bären", room: "Raum 1", note: null },
  { id: "s09", userId: "user-001", date: "2026-08-13", type: "frei",  startTime: null,    endTime: null,    group: "Bären", room: null,     note: null },
  { id: "s10", userId: "user-001", date: "2026-08-14", type: "spaet", startTime: "12:00", endTime: "19:00", group: "Bären", room: "Raum 2", note: null },

  // ----- Woche 3: 17.–21. August -----
  { id: "s11", userId: "user-001", date: "2026-08-17", type: "frueh", startTime: "07:00", endTime: "14:00", group: "Bären", room: "Raum 2", note: null },
  { id: "s12", userId: "user-001", date: "2026-08-18", type: "spaet", startTime: "12:00", endTime: "19:00", group: "Bären", room: "Raum 2", note: null },
  { id: "s13", userId: "user-001", date: "2026-08-19", type: "frei",  startTime: null,    endTime: null,    group: "Bären", room: null,     note: null },
  { id: "s14", userId: "user-001", date: "2026-08-20", type: "frueh", startTime: "07:00", endTime: "14:00", group: "Bären", room: "Raum 1", note: null },
  { id: "s15", userId: "user-001", date: "2026-08-21", type: "teil",  startTime: "09:00", endTime: "15:00", group: "Bären", room: "Raum 2", note: "Teildienst — Vertretung" },

  // ----- Woche 4: 24.–28. August -----
  { id: "s16", userId: "user-001", date: "2026-08-24", type: "frueh", startTime: "07:00", endTime: "14:00", group: "Bären", room: "Raum 2", note: null },
  { id: "s17", userId: "user-001", date: "2026-08-25", type: "urlaub", startTime: null,   endTime: null,    group: "Bären", room: null,     note: "Genehmigter Urlaub" },
  { id: "s18", userId: "user-001", date: "2026-08-26", type: "spaet", startTime: "12:00", endTime: "19:00", group: "Bären", room: "Raum 2", note: null },
  { id: "s19", userId: "user-001", date: "2026-08-27", type: "frueh", startTime: "07:00", endTime: "14:00", group: "Bären", room: "Raum 1", note: null },
  { id: "s20", userId: "user-001", date: "2026-08-28", type: "spaet", startTime: "12:00", endTime: "19:00", group: "Bären", room: "Raum 2", note: null },
];

// ============================================================
// Requests — alle Antragstypen und Status
// Status-Werte:
//   "ausstehend"          — Leitung prüft
//   "ausstehend-kollegin" — Diensttausch: wartet auf Zustimmung der Kollegin
//   "ausstehend-leitung"  — Diensttausch: Kollegin hat zugestimmt, Leitung prüft
//   "genehmigt"
//   "abgelehnt"
// ============================================================

/** @type {Array} */
export const MOCK_REQUESTS = [
  // --- Urlaub ausstehend ---
  {
    id: "req-001",
    userId: "user-001",
    createdAt: "2026-08-01T09:30:00+02:00",
    type: "urlaub",
    status: "ausstehend",
    dateFrom: "2026-08-10",
    dateTo: "2026-08-12",
    note: "Familienfeier — bitte um Genehmigung",
    reviewedAt: null,
    reviewNote: null,
    colleagueId: null,
    colleagueName: null,
    colleagueStatus: null,
  },
  // --- Urlaub genehmigt ---
  {
    id: "req-002",
    userId: "user-001",
    createdAt: "2026-07-15T11:00:00+02:00",
    type: "urlaub",
    status: "genehmigt",
    dateFrom: "2026-08-25",
    dateTo: "2026-08-25",
    note: null,
    reviewedAt: "2026-07-28T14:00:00+02:00",
    reviewNote: null,
    colleagueId: null,
    colleagueName: null,
    colleagueStatus: null,
  },
  // --- Dienstwunsch abgelehnt ---
  {
    id: "req-003",
    userId: "user-001",
    createdAt: "2026-07-20T08:15:00+02:00",
    type: "dienstwunsch",
    status: "abgelehnt",
    dateFrom: "2026-08-13",
    dateTo: "2026-08-13",
    note: "Würde gerne Frühschicht am 13. Aug übernehmen",
    reviewedAt: "2026-07-25T10:00:00+02:00",
    reviewNote: "Leider ist der Dienstplan für diesen Tag bereits vergeben. Bitte beim nächsten Monat anfragen.",
    colleagueId: null,
    colleagueName: null,
    colleagueStatus: null,
  },
  // --- Diensttausch: wartet auf Kollegin ---
  {
    id: "req-004",
    userId: "user-001",
    createdAt: "2026-07-27T16:00:00+02:00",
    type: "diensttausch",
    status: "ausstehend-kollegin",
    dateFrom: "2026-08-07",
    dateTo: "2026-08-07",
    note: "Ich hätte gerne den Frühdienst",
    reviewedAt: null,
    reviewNote: null,
    colleagueId: "user-002",
    colleagueName: "Lisa Bauer",
    colleagueStatus: "ausstehend",
    myShift: { date: "2026-08-07", type: "spaet", startTime: "12:00", endTime: "19:00" },
    colleagueShift: { date: "2026-08-07", type: "frueh", startTime: "07:00", endTime: "14:00" },
  },
  // --- Diensttausch: Kollegin hat zugestimmt, Leitung prüft ---
  {
    id: "req-005",
    userId: "user-001",
    createdAt: "2026-07-10T10:00:00+02:00",
    type: "diensttausch",
    status: "ausstehend-leitung",
    dateFrom: "2026-08-04",
    dateTo: "2026-08-04",
    note: null,
    reviewedAt: null,
    reviewNote: null,
    colleagueId: "user-004",
    colleagueName: "Mia Wagner",
    colleagueStatus: "zugestimmt",
    myShift: { date: "2026-08-04", type: "spaet", startTime: "12:00", endTime: "19:00" },
    colleagueShift: { date: "2026-08-04", type: "frueh", startTime: "07:00", endTime: "14:00" },
  },
  // --- Diensttausch: genehmigt ---
  {
    id: "req-006",
    userId: "user-001",
    createdAt: "2026-06-20T09:00:00+02:00",
    type: "diensttausch",
    status: "genehmigt",
    dateFrom: "2026-07-15",
    dateTo: "2026-07-15",
    note: null,
    reviewedAt: "2026-06-25T11:00:00+02:00",
    reviewNote: null,
    colleagueId: "user-003",
    colleagueName: "Sarah Klein",
    colleagueStatus: "zugestimmt",
    myShift: { date: "2026-07-15", type: "frueh", startTime: "07:00", endTime: "14:00" },
    colleagueShift: { date: "2026-07-15", type: "spaet", startTime: "12:00", endTime: "19:00" },
  },
  // --- Krankmeldung ---
  {
    id: "req-007",
    userId: "user-001",
    createdAt: "2026-07-28T07:45:00+02:00",
    type: "krankmeldung",
    status: "genehmigt",
    dateFrom: "2026-07-28",
    dateTo: "2026-07-30",
    note: null,
    reviewedAt: "2026-07-28T08:00:00+02:00",
    reviewNote: null,
    colleagueId: null,
    colleagueName: null,
    colleagueStatus: null,
  },
];

// ============================================================
// Notifications — Mitteilungen der Leitung
// Priorität: "normal" | "wichtig" | "sehrwichtig"
// "sehrwichtig" muss bestätigt werden
// ============================================================

/** @type {Array} */
export const MOCK_NOTIFICATIONS = [
  // --- SEHR WICHTIG: Evakuierungsübung (muss bestätigt werden) ---
  {
    id: "notif-001",
    createdAt: "2026-07-28T08:00:00+02:00",
    authorId: "user-leitung-001",
    title: "Evakuierungsübung am 05.08. um 10:00 Uhr",
    body: "Am Mittwoch, 05. August um 10:00 Uhr findet eine Pflicht-Evakuierungsübung statt. Alle Mitarbeitenden müssen anwesend sein. Bitte informiert die Eltern, dass die Kinder für diese Zeit kurz ins Freie gebracht werden. Die Übung dauert ca. 20 Minuten. Bitte bestätigt den Erhalt dieser Mitteilung.",
    targetGroups: ["alle"],
    priority: "sehrwichtig",
    type: "sehrwichtig",
    confirmedBy: [],
  },
  // --- WICHTIG: Notfallkontakte (kein Bestätigen nötig, aber hervorgehoben) ---
  {
    id: "notif-002",
    createdAt: "2026-07-27T10:30:00+02:00",
    authorId: "user-leitung-001",
    title: "Notfallkontakte bis 31.07. aktualisieren",
    body: "Liebe Mitarbeitende, bitte gebt bis Ende Juli eure aktuellen Notfallkontakte bei der Leitung ab. Dies ist aus versicherungsrechtlichen Gründen vorgeschrieben. Bitte sprecht Sandra Hoffmann direkt an oder legt die Daten im Büro ab.",
    targetGroups: ["alle"],
    priority: "wichtig",
    type: "wichtig",
    confirmedBy: ["user-001"],
  },
  // --- NORMAL: Hausmeister Gruppe Bären ---
  {
    id: "notif-003",
    createdAt: "2026-07-26T14:00:00+02:00",
    authorId: "user-leitung-001",
    title: "04.08. Hausmeister kommt um 15:00 Uhr",
    body: "Der Hausmeister kommt am Dienstag, 04. August um 15:00 Uhr in die Gruppe Bären, um die defekte Heizung zu reparieren. Bitte räumt den Bereich vor der Heizkörpernische frei. Die Reparatur dauert voraussichtlich 30–60 Minuten.",
    targetGroups: ["Bären"],
    priority: "normal",
    type: "info",
    confirmedBy: [],
  },
  // --- NORMAL: Sommerferienplan ---
  {
    id: "notif-004",
    createdAt: "2026-07-25T09:00:00+02:00",
    authorId: "user-leitung-001",
    title: "Sommerferienplan Kita Villa Kunterbunt",
    body: "Liebe Mitarbeitende, anbei der Ferienplan für die Sommerwochen. Die Kita bleibt vom 17. bis 21. August für Betriebsferien geschlossen. Bitte plant eure Urlaube entsprechend. Betreuungsbedarf für die Ferienwochen bitte bis 5. August anmelden.",
    targetGroups: ["alle"],
    priority: "normal",
    type: "info",
    confirmedBy: ["user-001"],
  },
  // --- NORMAL: Raumwechsel Bären ---
  {
    id: "notif-005",
    createdAt: "2026-07-22T14:00:00+02:00",
    authorId: "user-leitung-001",
    title: "Raumwechsel: Gruppe Bären ab 3. August",
    body: "Ab dem 3. August findet die Bären-Gruppe vorübergehend in Raum 1 statt. Raum 2 wird renoviert (neue Böden). Die Renovierung dauert voraussichtlich bis zum 15. August. Materialien und Spielzeug bitte bis Freitag, 31. Juli, umräumen.",
    targetGroups: ["Bären"],
    priority: "normal",
    type: "info",
    confirmedBy: [],
  },
  // --- TAUSCHANFRAGE: Lisa Bauer fragt Vanessa (spezielle Notification) ---
  {
    id: "notif-006",
    createdAt: "2026-07-28T11:30:00+02:00",
    authorId: "user-002",
    title: "Tauschanfrage von Lisa Bauer",
    body: "Lisa Bauer möchte mit dir tauschen: Sie übernimmt deinen Spätdienst am Mo, 10. Aug (12:00–19:00). Dafür übernimmst du ihren Frühdienst am Mo, 10. Aug (07:00–14:00). Bitte stimme zu oder lehne ab.",
    targetGroups: ["alle"],
    priority: "wichtig",
    type: "tausch",
    confirmedBy: [],
    swapData: {
      requestId: "ext-req-001",
      fromUserId: "user-002",
      fromUserName: "Lisa Bauer",
      offerShift: { date: "2026-08-10", type: "frueh", startTime: "07:00", endTime: "14:00" },
      wantShift:  { date: "2026-08-10", type: "spaet", startTime: "12:00", endTime: "19:00" },
    },
  },
  // --- ARCHIV: Teammeeting (älter als 14 Tage, archiviert) ---
  {
    id: "notif-007",
    createdAt: "2026-07-01T08:00:00+02:00",
    authorId: "user-leitung-001",
    title: "Teammeeting 7. Juli, 19:30 Uhr",
    body: "Das monatliche Teammeeting findet am Montag, 7. Juli um 19:30 Uhr im großen Besprechungsraum statt. Bitte pünktlich erscheinen. Tagesordnung: (1) Rückblick Juni, (2) Planung Sommerfest, (3) Neues Sicherheitskonzept.",
    targetGroups: ["alle"],
    priority: "normal",
    type: "info",
    confirmedBy: ["user-001"],
  },
  // --- ARCHIV: Erste-Hilfe Kurs (älter als 14 Tage) ---
  {
    id: "notif-008",
    createdAt: "2026-06-15T09:00:00+02:00",
    authorId: "user-leitung-001",
    title: "Erste-Hilfe Auffrischung am 30. Juni",
    body: "Für alle Mitarbeitenden ist am 30. Juni von 14:00–18:00 Uhr eine Erste-Hilfe-Auffrischung geplant. Teilnahme ist verpflichtend. Bitte tragt euch im Büro ein.",
    targetGroups: ["alle"],
    priority: "wichtig",
    type: "wichtig",
    confirmedBy: ["user-001"],
  },
];
