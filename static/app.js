/* OGVIEW – One Global View. Frontend-Logik: Heatmap, News, Kalender, Kerzenchart. */
"use strict";

const I18N = {
  de: {
    spruch: "One Global View – The World. The Markets. One Overview.",
    aktualisieren: "Aktualisieren", tab_heatmap: "Heatmap", tab_news: "News",
    tab_kalender: "Wirtschaftskalender", f_alle: "Alle", f_metalle: "Edelmetalle",
    f_crypto: "Crypto", f_aktien: "Aktien", f_hoch: "Hoch wichtig", f_mittel: "Mittel",
    f_zinsen: "Zinsentscheide", f_arbeit: "Arbeitsmarkt", f_inflation: "Inflation",
    f_bip: "BIP", f_konjunktur: "Konjunktur", f_unternehmen: "Unternehmenszahlen",
    lade: "Daten werden geladen …", leg_pos: "Kursgewinn", leg_neg: "Kursverlust",
    leg_hint: "Kachel anklicken für Kurschart (Kerzen, SMA, RSI)",
    rsi_label: "RSI (14):", fuss_hinweis: "Kursdaten mit Verzögerung, keine Anlageberatung.",
    heute: "Heute", morgen: "Morgen", diese_woche: "Weitere Tage dieser Woche",
    zeit: "Zeit", land: "Land", wichtigkeit: "Wichtigkeit", ereignis: "Ereignis",
    ist: "Ist", prognose: "Prognose", vorher: "Vorher", alle_quellen: "Alle Quellen",
    keine_news: "Keine Nachrichten geladen – Aktualisieren drücken.",
    keine_termine: "Keine Termine gefunden.", fehler_daten: "Datenquelle nicht erreichbar – bitte aktualisieren.",
  },
  en: {
    spruch: "One Global View – The World. The Markets. One Overview.",
    aktualisieren: "Refresh", tab_heatmap: "Heatmap", tab_news: "News",
    tab_kalender: "Economic Calendar", f_alle: "All", f_metalle: "Precious Metals",
    f_crypto: "Crypto", f_aktien: "Stocks", f_hoch: "High impact", f_mittel: "Medium",
    f_zinsen: "Rate Decisions", f_arbeit: "Labor Market", f_inflation: "Inflation",
    f_bip: "GDP", f_konjunktur: "Economy", f_unternehmen: "Earnings",
    lade: "Loading data …", leg_pos: "Gain", leg_neg: "Loss",
    leg_hint: "Click a tile for the price chart (candles, SMA, RSI)",
    rsi_label: "RSI (14):", fuss_hinweis: "Price data delayed, not investment advice.",
    heute: "Today", morgen: "Tomorrow", diese_woche: "Rest of this week",
    zeit: "Time", land: "Country", wichtigkeit: "Impact", ereignis: "Event",
    ist: "Actual", prognose: "Forecast", vorher: "Previous", alle_quellen: "All sources",
    keine_news: "No news loaded – press refresh.", keine_termine: "No events found.",
    fehler_daten: "Data source unreachable – please refresh.",
  },
};

const KAT_NAMEN = { zinsen: "f_zinsen", arbeitsmarkt: "f_arbeit", inflation: "f_inflation",
  bip: "f_bip", konjunktur: "f_konjunktur", unternehmen: "f_unternehmen", sonstiges: "f_alle" };

let sprache = "de";
let assetFilter = "alle";
let indexWahl = "dax";
let heatmapDaten = null;
let newsDaten = [];
let quellenFilter = "alle";
let kalenderDaten = [];
let impactFilter = "alle";
let katFilter = "alle";
let aktuellerChart = null;

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

/* ---------- i18n ---------- */
function uebersetze() {
  $$("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (I18N[sprache][key]) el.textContent = I18N[sprache][key];
  });
  document.documentElement.lang = sprache;
}

/* ---------- Laden ---------- */
async function lade(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(r.status);
  return r.json();
}

async function ladeHeatmap(force = false) {
  const box = $("#heatmap");
  try {
    heatmapDaten = await lade(`/api/heatmap${force ? "?force=1" : ""}`);
    zeigeHeatmap();
  } catch (e) {
    box.innerHTML = `<div class="ladehinweis">${I18N[sprache].fehler_daten}</div>`;
  }
}

function farbe(chg) {
  if (chg === null || chg === undefined) return "#12181e";
  const x = Math.min(Math.abs(chg) / 3, 1);
  if (chg >= 0) {
    const r = Math.round(18 + (20 - 18) * x), g = Math.round(24 + (224 - 24) * x), b = Math.round(30 + (207 - 30) * x);
    return `rgb(${r},${g},${b})`;
  }
  const r = Math.round(18 + (255 - 18) * x), g = Math.round(24 + (77 - 24) * x), b = Math.round(30 + (94 - 30) * x);
  return `rgb(${r},${g},${b})`;
}

function textFarbe(chg) {
  return (chg !== null && chg !== undefined && Math.abs(chg) > 1.2) ? "#04211e" : "var(--text)";
}

function tile(w, istCrypto, coinId) {
  const prozent = w.chg === null || w.chg === undefined ? "–" : (w.chg > 0 ? "+" : "") + w.chg.toFixed(2) + "%";
  const klasse = w.chg !== null && w.chg < 0 ? "neg" : "pos";
  return `<div class="tile" style="background:${farbe(w.chg)};color:${textFarbe(w.chg)}"
    data-sym="${w.sym}" data-crypto="${istCrypto ? 1 : 0}" data-id="${coinId || ""}" data-name="${w.name}">
    <div><div class="sym">${w.sym}</div><div class="name">${w.name}</div></div>
    <div><div class="preis">${w.price !== null ? w.price.toLocaleString("de-DE", {maximumFractionDigits: 4}) : "–"}</div>
    <div class="chg ${klasse}">${prozent}</div></div></div>`;
}

function zeigeHeatmap() {
  const box = $("#heatmap");
  if (!heatmapDaten) return;
  let html = "";
  const gruppe = (titel, liste, istCrypto) => {
    if (!liste || !liste.length) return "";
    return `<div class="gruppe-titel">${titel}</div>` +
      liste.map((w) => tile(w, istCrypto, w.id)).join("");
  };
  if (assetFilter === "alle" || assetFilter === "metalle") {
    html += gruppe("Edelmetalle & Rohstoffe", heatmapDaten.metalle, false);
  }
  if (assetFilter === "alle" || assetFilter === "crypto") {
    html += gruppe("Crypto (nach Market Cap)", heatmapDaten.crypto, true);
  }
  if (assetFilter === "alle" || assetFilter === "aktien") {
    for (const [key, cfg] of Object.entries(heatmapDaten)) {
      if (key === "crypto" || key === "metalle") continue;
      if (assetFilter === "aktien" && key !== indexWahl) continue;
      html += gruppe(cfg.name, cfg.symbole, false);
    }
  }
  box.innerHTML = html || `<div class="ladehinweis">${I18N[sprache].fehler_daten}</div>`;
  $$("#heatmap .tile").forEach((t) => t.addEventListener("click", () => oeffneChart(t)));
}

/* ---------- News ---------- */
async function ladeNews(force = false) {
  const box = $("#news-liste");
  try {
    newsDaten = await lade(`/api/news?lang=${sprache}${force ? "&force=1" : ""}`);
    baueQuellenChips();
    zeigeNews();
  } catch (e) {
    box.innerHTML = `<div class="ladehinweis">${I18N[sprache].fehler_daten}</div>`;
  }
}

function baueQuellenChips() {
  const box = $("#quellen-chips");
  const namen = newsDaten.filter((q) => q.items.length).map((q) => q.name);
  box.innerHTML = `<button class="chip ${quellenFilter === "alle" ? "aktiv" : ""}" data-q="alle">${I18N[sprache].alle_quellen}</button>` +
    namen.map((n) => `<button class="chip ${quellenFilter === n ? "aktiv" : ""}" data-q="${n}">${n}</button>`).join("");
  $$("#quellen-chips .chip").forEach((c) => c.addEventListener("click", () => {
    quellenFilter = c.dataset.q; baueQuellenChips(); zeigeNews();
  }));
}

function zeigeNews() {
  const box = $("#news-liste");
  const quellen = quellenFilter === "alle" ? newsDaten : newsDaten.filter((q) => q.name === quellenFilter);
  let html = "";
  let zaehler = 0;
  for (const q of quellen) {
    if (!q.items.length) continue;
    for (const n of q.items) {
      zaehler++;
      html += `<a class="news-karte" href="${n.link}" target="_blank" rel="noopener">
        <div class="news-kopf"><span class="quelle-badge">${n.quelle}</span>
        <span class="news-zeit">${kurzZeit(n.zeit)}</span></div>
        <div class="news-titel">${esc(n.titel)}</div>
        ${n.text ? `<div class="news-text">${esc(n.text)}…</div>` : ""}</a>`;
      if (zaehler >= 60) break;
    }
    if (zaehler >= 60) break;
  }
  box.innerHTML = html || `<div class="ladehinweis">${I18N[sprache].keine_news}</div>`;
}

function kurzZeit(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString(sprache === "de" ? "de-DE" : "en-GB",
    {day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"});
}

function esc(s) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ---------- Kalender ---------- */
async function ladeKalender(force = false) {
  const box = $("#kalender-liste");
  try {
    kalenderDaten = await lade(`/api/calendar${force ? "?force=1" : ""}`);
    zeigeKalender();
  } catch (e) {
    box.innerHTML = `<div class="ladehinweis">${I18N[sprache].fehler_daten}</div>`;
  }
}

function zeigeKalender() {
  const box = $("#kalender-liste");
  const heute = new Date().toISOString().slice(0, 10);
  const morgen = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const gefiltert = kalenderDaten.filter((e) =>
    (impactFilter === "alle" || e.impact === impactFilter) &&
    (katFilter === "alle" || e.kategorie === katFilter));

  const tabelle = (liste) => `
    <table class="kal-tabelle"><thead><tr>
      <th>${I18N[sprache].zeit}</th><th>${I18N[sprache].land}</th>
      <th>${I18N[sprache].ereignis}</th><th>${I18N[sprache].ist}</th>
      <th>${I18N[sprache].prognose}</th><th>${I18N[sprache].vorher}</th></tr></thead><tbody>
      ${liste.map((e) => `<tr>
        <td>${e.zeit}</td>
        <td><span class="land-badge">${e.land}</span></td>
        <td><span class="impact ${e.impact}" title="${e.impact}"></span> ${esc(e.titel)}
            <span class="werte">· ${I18N[sprache][KAT_NAMEN[e.kategorie]] || ""}</span></td>
        <td><b>${esc(e.ist || "–")}</b></td>
        <td class="werte">${esc(e.prognose || "–")}</td>
        <td class="werte">${esc(e.vorher || "–")}</td></tr>`).join("")}
    </tbody></table>`;

  const heute_liste = gefiltert.filter((e) => e.iso === heute);
  const morgen_liste = gefiltert.filter((e) => e.iso === morgen);
  const rest = gefiltert.filter((e) => e.iso !== heute && e.iso !== morgen);

  box.innerHTML = `
    <div class="kal-tag"><div class="kal-tag-titel">${I18N[sprache].heute}
      <span class="datum">${new Date().toLocaleDateString(sprache === "de" ? "de-DE" : "en-GB", {weekday: "long", day: "2-digit", month: "long"})}</span></div>
      ${heute_liste.length ? tabelle(heute_liste) : `<div class="quelle-leer">${I18N[sprache].keine_termine}</div>`}</div>
    <div class="kal-tag"><div class="kal-tag-titel">${I18N[sprache].morgen}</div>
      ${morgen_liste.length ? tabelle(morgen_liste) : `<div class="quelle-leer">${I18N[sprache].keine_termine}</div>`}</div>
    <div class="kal-tag"><div class="kal-tag-titel">${I18N[sprache].diese_woche}</div>
      ${rest.length ? tabelle(rest) : `<div class="quelle-leer">${I18N[sprache].keine_termine}</div>`}</div>`;
}

/* ---------- Chart (Kerzen + SMA + RSI) ---------- */
async function oeffneChart(tileEl) {
  const sym = tileEl.dataset.sym;
  const istCrypto = tileEl.dataset.crypto === "1";
  const coinId = tileEl.dataset.id;
  $("#modal-titel").textContent = `${sym} · ${tileEl.dataset.name}`;
  $("#modal").classList.add("aktiv");
  aktuellerChart = {sym, istCrypto, coinId, range: "1M"};
  await ladeChart();
}

async function ladeChart() {
  const {sym, istCrypto, coinId, range} = aktuellerChart;
  const canvas = $("#chart");
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#12181e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#7d8f99";
  ctx.font = "13px Segoe UI";
  ctx.fillText(I18N[sprache].lade, 20, 40);
  let daten;
  try {
    daten = await lade(`/api/candles?symbol=${encodeURIComponent(sym)}&range=${range}` +
      (istCrypto ? `&crypto=1&id=${encodeURIComponent(coinId)}` : ""));
  } catch (e) {
    daten = {fehler: "net"};
  }
  if (daten.fehler || !daten.candles || !daten.candles.length) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ff4d5e";
    ctx.fillText(I18N[sprache].fehler_daten, 20, 40);
    return;
  }
  const letzte = daten.candles[daten.candles.length - 1];
  $("#modal-preis").textContent = letzte[4].toLocaleString("de-DE", {maximumFractionDigits: 4});
  const erste = daten.candles[0][4];
  const chg = (letzte[4] - erste) / erste * 100;
  const chgEl = $("#modal-chg");
  chgEl.textContent = (chg > 0 ? "+" : "") + chg.toFixed(2) + "%";
  chgEl.className = "chg " + (chg >= 0 ? "pos" : "neg");
  zeichneKerzen(canvas, daten);
  zeichneRSI($("#rsi-chart"), daten.rsi);
  const letzterRsi = [...daten.rsi].reverse().find((r) => r !== null);
  $(".rsi-wert").textContent = `${I18N[sprache].rsi_label} ${letzterRsi ?? "–"}` +
    (letzterRsi ? (letzterRsi >= 70 ? "  (überkauft)" : letzterRsi <= 30 ? "  (überverkauft)" : "") : "");
}

function zeichneKerzen(canvas, daten) {
  const dpr = window.devicePixelRatio || 1;
  const breite = canvas.clientWidth || canvas.parentElement.clientWidth;
  const hoehe = 340;
  canvas.width = breite * dpr; canvas.height = hoehe * dpr;
  canvas.style.height = hoehe + "px";
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.fillStyle = "#12181e";
  ctx.fillRect(0, 0, breite, hoehe);

  const kerzen = daten.candles;
  const padL = 8, padR = 64, padO = 14, padU = 24;
  const n = kerzen.length;
  let min = Infinity, max = -Infinity;
  for (const k of kerzen) { min = Math.min(min, k[3]); max = Math.max(max, k[2]); }
  const spanne = (max - min) || 1;
  const y = (v) => padO + (1 - (v - min) / spanne) * (hoehe - padO - padU);
  const schritt = (breite - padL - padR) / n;
  const koerper = Math.max(1.5, Math.min(schritt * 0.65, 14));

  ctx.strokeStyle = "#223039";
  ctx.fillStyle = "#7d8f99";
  ctx.font = "10px Segoe UI";
  for (let i = 0; i <= 4; i++) {
    const vy = padO + i * (hoehe - padO - padU) / 4;
    const wert = max - (i / 4) * spanne;
    ctx.beginPath(); ctx.moveTo(padL, vy); ctx.lineTo(breite - padR, vy); ctx.stroke();
    ctx.fillText(wert.toLocaleString("de-DE", {maximumFractionDigits: 2}), breite - padR + 6, vy + 3);
  }

  kerzen.forEach((k, i) => {
    const x = padL + i * schritt + schritt / 2;
    const [t, o, h, l, c] = k;
    const steigend = c >= o;
    ctx.strokeStyle = ctx.fillStyle = steigend ? "#14e0cf" : "#ff4d5e";
    ctx.beginPath(); ctx.moveTo(x, y(h)); ctx.lineTo(x, y(l)); ctx.lineWidth = 1; ctx.stroke();
    const oben = y(Math.max(o, c)), unten = y(Math.min(o, c));
    ctx.fillRect(x - koerper / 2, oben, koerper, Math.max(1, unten - oben));
  });

  const linien = [["20", "#f5c542"], ["50", "#9b7df0"], ["200", "#ff9d5c"]];
  for (const [key, farbe] of linien) {
    const werte = daten.sma[key];
    if (!werte || !werte.some((w) => w !== null)) continue;
    ctx.strokeStyle = farbe; ctx.lineWidth = 1.4; ctx.beginPath();
    let gestartet = false;
    werte.forEach((w, i) => {
      if (w === null) { gestartet = false; return; }
      const x = padL + i * schritt + schritt / 2;
      if (!gestartet) { ctx.moveTo(x, y(w)); gestartet = true; }
      else ctx.lineTo(x, y(w));
    });
    ctx.stroke();
  }

  ctx.fillStyle = "#7d8f99"; ctx.font = "10px Segoe UI";
  const schritte = Math.min(6, n);
  for (let i = 0; i < schritte; i++) {
    const idx = Math.floor(i * (n - 1) / Math.max(1, schritte - 1));
    const datum = new Date(kerzen[idx][0]);
    ctx.fillText(datum.toLocaleDateString("de-DE", {day: "2-digit", month: "short", year: "2-digit"}),
      padL + idx * schritt - 18, hoehe - 6);
  }
}

function zeichneRSI(canvas, werte) {
  const dpr = window.devicePixelRatio || 1;
  const breite = canvas.clientWidth || canvas.parentElement.clientWidth;
  const hoehe = 110;
  canvas.width = breite * dpr; canvas.height = hoehe * dpr;
  canvas.style.height = hoehe + "px";
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.fillStyle = "#12181e"; ctx.fillRect(0, 0, breite, hoehe);
  const n = werte.length;
  if (!n) return;
  const y = (v) => 8 + (1 - v / 100) * (hoehe - 16);
  ctx.strokeStyle = "#223039";
  [30, 50, 70].forEach((lvl) => {
    ctx.beginPath(); ctx.moveTo(0, y(lvl)); ctx.lineTo(breite, y(lvl));
    ctx.setLineDash(lvl === 50 ? [] : [4, 4]);
    ctx.strokeStyle = lvl === 50 ? "#223039" : (lvl === 70 ? "#ff4d5e" : "#14e0cf");
    ctx.stroke();
  });
  ctx.setLineDash([]);
  ctx.strokeStyle = "#ff9d5c"; ctx.lineWidth = 1.4; ctx.beginPath();
  let gestartet = false;
  werte.forEach((w, i) => {
    if (w === null) { gestartet = false; return; }
    const x = i / n * breite;
    if (!gestartet) { ctx.moveTo(x, y(w)); gestartet = true; } else ctx.lineTo(x, y(w));
  });
  ctx.stroke();
}

/* ---------- Refresh & Events ---------- */
async function allesLaden(force = false) {
  const knopf = $("#refresh");
  knopf.classList.add("dreht");
  await Promise.all([
    ladeHeatmap(force),
    ladeNews(force),
    ladeKalender(force),
  ]);
  knopf.classList.remove("dreht");
}

document.addEventListener("DOMContentLoaded", () => {
  uebersetze();
  allesLaden();

  $("#refresh").addEventListener("click", () => allesLaden(true));

  $$(".tab").forEach((t) => t.addEventListener("click", () => {
    $$(".tab").forEach((x) => x.classList.remove("aktiv"));
    $$(".tab-inhalt").forEach((x) => x.classList.remove("aktiv"));
    t.classList.add("aktiv");
    $(`#tab-${t.dataset.tab}`).classList.add("aktiv");
  }));

  $$(".sprache").forEach((b) => b.addEventListener("click", () => {
    if (sprache === b.dataset.lang) return;
    sprache = b.dataset.lang;
    $$(".sprache").forEach((x) => x.classList.toggle("aktiv", x === b));
    uebersetze();
    ladeNews();
    if (kalenderDaten.length) zeigeKalender();
  }));

  $$("#asset-chips .chip").forEach((c) => c.addEventListener("click", () => {
    assetFilter = c.dataset.asset;
    $$("#asset-chips .chip").forEach((x) => x.classList.toggle("aktiv", x === c));
    $("#index-wahl").style.display = assetFilter === "aktien" ? "" : "none";
    zeigeHeatmap();
  }));

  $("#index-wahl").addEventListener("change", (e) => {
    indexWahl = e.target.value;
    zeigeHeatmap();
  });

  $$("#impact-chips .chip").forEach((c) => c.addEventListener("click", () => {
    impactFilter = c.dataset.impact;
    $$("#impact-chips .chip").forEach((x) => x.classList.toggle("aktiv", x === c));
    zeigeKalender();
  }));

  $$("#kategorie-chips .chip").forEach((c) => c.addEventListener("click", () => {
    katFilter = c.dataset.kat;
    $$("#kategorie-chips .chip").forEach((x) => x.classList.toggle("aktiv", x === c));
    zeigeKalender();
  }));

  $$("#range-leiste .range").forEach((b) => b.addEventListener("click", () => {
    $$("#range-leiste .range").forEach((x) => x.classList.remove("aktiv"));
    b.classList.add("aktiv");
    aktuellerChart.range = b.dataset.range;
    ladeChart();
  }));

  $("#modal-schliessen").addEventListener("click", () => $("#modal").classList.remove("aktiv"));
  $("#modal").addEventListener("click", (e) => {
    if (e.target === $("#modal")) $("#modal").classList.remove("aktiv");
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") $("#modal").classList.remove("aktiv");
  });

  setInterval(() => allesLaden(false), 5 * 60 * 1000);
});
