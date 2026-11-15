# -*- coding: utf-8 -*-
"""OGVIEW – One Global View. The World. The Markets. One Overview.

Backend: stellt Live-Daten ohne API-Keys bereit.
- Heatmap: Krypto (CoinGecko), Aktien nach Index (Yahoo), Edelmetalle (Yahoo)
- Kurse: Kerzen + SMA + RSI (Binance für Krypto, Yahoo für den Rest)
- News: RSS-Feeds (BBC, WSJ, FT, CNBC, Bloomberg, Der Aktionär, tagesschau, ...)
- Wirtschaftskalender: ForexFactory-Wochenkalender
Alles mit Cache; ?force=1 umgeht den Cache (Aktualisieren-Knopf).
"""
import json
import re
import time
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import requests
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

UA = {"User-Agent": "Mozilla/5.0 (OGVIEW/1.0)"}
CACHE = {}
TIMEOUT = 12
ET_TZ = ZoneInfo("US/Eastern")
BERLIN = ZoneInfo("Europe/Berlin")


def cache_get(key, ttl, force=False):
    hit = CACHE.get(key)
    if not force and hit and time.time() - hit[0] < ttl:
        return hit[1]
    return None


def cache_put(key, value):
    CACHE[key] = (time.time(), value)
    return value


# ---------- Indizes (Top-Werte nach Marktkapitalisierung) ----------
INDICES = {
    "dax": {"name": "DAX 40", "symbole": [
        ("SAP.DE", "SAP"), ("SIE.DE", "Siemens"), ("ALV.DE", "Allianz"),
        ("DTE.DE", "Deutsche Telekom"), ("MUV2.DE", "Munich Re"), ("RHM.DE", "Rheinmetall"),
        ("BAS.DE", "BASF"), ("BMW.DE", "BMW"), ("MBG.DE", "Mercedes-Benz"),
        ("VOW3.DE", "Volkswagen"), ("RWE.DE", "RWE"), ("AIR.PA", "Airbus"),
        ("BAYN.DE", "Bayer"), ("DPW.DE", "DHL Group"), ("LIN.DE", "Linde"),
        ("EOAN.DE", "E.ON"), ("FME.DE", "Fresenius Medical"), ("HEN3.DE", "Henkel"),
        ("MRK.DE", "Merck"), ("ZAL.DE", "Zalando"), ("SRT3.DE", "Sartorius"),
        ("HEI.DE", "Heidelberg Materials"), ("BEI.DE", "Beiersdorf"),
        ("FRE.DE", "Fresenius"), ("CON.DE", "Continental"), ("QIA.DE", "Qiagen"),
        ("SY1.DE", "Symrise"), ("BNR.DE", "Brenntag"), ("VNA.DE", "Vonovia"),
        ("GXI.DE", "Infineon")]},
    "sp500": {"name": "S&P 500", "symbole": [
        ("AAPL", "Apple"), ("MSFT", "Microsoft"), ("NVDA", "NVIDIA"),
        ("GOOGL", "Alphabet"), ("AMZN", "Amazon"), ("META", "Meta Platforms"),
        ("BRK-B", "Berkshire Hathaway"), ("LLY", "Eli Lilly"), ("AVGO", "Broadcom"),
        ("TSLA", "Tesla"), ("JPM", "JPMorgan Chase"), ("V", "Visa"),
        ("UNH", "UnitedHealth"), ("XOM", "Exxon Mobil"), ("MA", "Mastercard"),
        ("PG", "Procter & Gamble"), ("JNJ", "Johnson & Johnson"), ("COST", "Costco"),
        ("HD", "Home Depot"), ("ABBV", "AbbVie"), ("WMT", "Walmart"),
        ("NFLX", "Netflix"), ("BAC", "Bank of America"), ("KO", "Coca-Cola"),
        ("CRM", "Salesforce")]},
    "nasdaq": {"name": "NASDAQ 100", "symbole": [
        ("AAPL", "Apple"), ("MSFT", "Microsoft"), ("NVDA", "NVIDIA"),
        ("AMZN", "Amazon"), ("GOOGL", "Alphabet"), ("META", "Meta Platforms"),
        ("TSLA", "Tesla"), ("AVGO", "Broadcom"), ("PEP", "PepsiCo"), ("COST", "Costco"),
        ("NFLX", "Netflix"), ("AMD", "AMD"), ("ADBE", "Adobe"), ("QCOM", "Qualcomm"),
        ("TXN", "Texas Instruments"), ("INTU", "Intuit"), ("AMAT", "Applied Materials"),
        ("MU", "Micron"), ("CSCO", "Cisco"), ("ADP", "ADP"), ("GILD", "Gilead"),
        ("AMGN", "Amgen"), ("ISRG", "Intuitive Surgical"), ("SBUX", "Starbucks"),
        ("MDLZ", "Mondelez")]},
    "dow": {"name": "Dow Jones", "symbole": [
        ("AAPL", "Apple"), ("MSFT", "Microsoft"), ("AMZN", "Amazon"), ("NVDA", "NVIDIA"),
        ("JPM", "JPMorgan Chase"), ("V", "Visa"), ("UNH", "UnitedHealth"),
        ("HD", "Home Depot"), ("PG", "Procter & Gamble"), ("KO", "Coca-Cola"),
        ("MCD", "McDonald's"), ("CAT", "Caterpillar"), ("GS", "Goldman Sachs"),
        ("BA", "Boeing"), ("CSCO", "Cisco"), ("WMT", "Walmart"), ("MMM", "3M"),
        ("AXP", "American Express"), ("IBM", "IBM"), ("TRV", "Travelers"),
        ("JNJ", "Johnson & Johnson"), ("MRK", "Merck"), ("CVX", "Chevron"),
        ("NKE", "Nike"), ("DIS", "Disney"), ("HON", "Honeywell"), ("RTX", "RTX"),
        ("DOW", "Dow Inc."), ("INTC", "Intel"), ("AMGN", "Amgen")]},
    "stoxx": {"name": "EURO STOXX 50", "symbole": [
        ("ASML.AS", "ASML"), ("MC.PA", "LVMH"), ("TTE.PA", "TotalEnergies"),
        ("SIE.DE", "Siemens"), ("ALV.DE", "Allianz"), ("OR.PA", "L'Oréal"),
        ("SAP.DE", "SAP"), ("NOVO-B.CO", "Novo Nordisk"), ("DTE.DE", "Deutsche Telekom"),
        ("SAN.MC", "Banco Santander"), ("IBE.MC", "Iberdrola"), ("ENEL.MI", "Enel"),
        ("ENI.MI", "Eni"), ("ISP.MI", "Intesa Sanpaolo"), ("UCG.MI", "UniCredit"),
        ("BNP.PA", "BNP Paribas"), ("AIR.PA", "Airbus"), ("SU.PA", "Schneider Electric"),
        ("RMS.PA", "Hermès"), ("EOAN.DE", "E.ON"), ("ING.AS", "ING Groep"),
        ("AD.AS", "Ahold Delhaize"), ("EL.PA", "EssilorLuxottica"), ("ABI.BR", "AB InBev")]},
}

METALLE = [
    ("GC=F", "Gold"), ("SI=F", "Silber"), ("PL=F", "Platin"), ("HG=F", "Kupfer"),
]

STABIL = {"usdt", "usdc", "dai", "fdusd", "usde", "tusd", "busd", "usds"}


# ---------- Heatmap ----------
def yahoo_quote(symbol, name):
    key = f"q:{symbol}"
    hit = cache_get(key, 600)
    if hit:
        return hit
    try:
        r = requests.get(
            f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}",
            params={"range": "5d", "interval": "1d"}, headers=UA, timeout=TIMEOUT)
        j = r.json()["chart"]["result"][0]
        closes = [c for c in j["indicators"]["quote"][0]["close"] if c is not None]
        meta = j["meta"]
        price = meta.get("regularMarketPrice", closes[-1])
        prev = closes[-2] if len(closes) >= 2 else price
        chg = (price - prev) / prev * 100 if prev else 0.0
        w = {"sym": symbol, "name": name, "price": round(price, 4), "chg": round(chg, 2),
             "cur": meta.get("currency", "")}
        return cache_put(key, w)
    except Exception:
        return {"sym": symbol, "name": name, "price": None, "chg": None, "cur": ""}


def crypto_liste():
    hit = cache_get("crypto", 300)
    if hit:
        return hit
    try:
        r = requests.get("https://api.coingecko.com/api/v3/coins/markets",
                         params={"vs_currency": "usd", "order": "market_cap_desc",
                                 "per_page": 30, "page": 1},
                         headers=UA, timeout=TIMEOUT)
        out = [{"sym": c["symbol"].upper(), "id": c["id"], "name": c["name"],
                "price": c["current_price"], "chg": round(c.get("price_change_percentage_24h") or 0, 2),
                "cap": c.get("market_cap", 0)}
               for c in r.json() if c["symbol"].lower() not in STABIL]
        return cache_put("crypto", out)
    except Exception:
        return []


def heatmap(force=False):
    key = "heatmap"
    hit = cache_get(key, 300, force)
    if hit:
        return hit

    def alle_aktien():
        auftraege = [(s, n, idx) for idx, cfg in INDICES.items() for s, n in cfg["symbole"]]
        auftraege += [(s, n, "metalle") for s, n in METALLE]
        with ThreadPoolExecutor(max_workers=16) as pool:
            futures = {pool.submit(yahoo_quote, s, n): idx for s, n, idx in auftraege}
            ergebnis = {}
            for fut, idx in futures.items():
                ergebnis.setdefault(idx, []).append(fut.result())
        for idx in ergebnis:
            ergebnis[idx] = [w for w in ergebnis[idx] if w["price"] is not None]
        return ergebnis

    with ThreadPoolExecutor(max_workers=2) as pool:
        f_aktien = pool.submit(alle_aktien)
        f_crypto = pool.submit(crypto_liste)
        daten = f_aktien.result()
        daten["crypto"] = f_crypto.result()
    return cache_put(key, daten)


# ---------- Kerzen + SMA + RSI ----------
RANGES = {
    "1T":  {"y": ("1d", "5m"),  "b": ("5m", 288)},
    "5T":  {"y": ("5d", "15m"), "b": ("15m", 240)},
    "1M":  {"y": ("1mo", "1d"), "b": ("1d", 31)},
    "3M":  {"y": ("3mo", "1d"), "b": ("1d", 91)},
    "1J":  {"y": ("1y", "1d"),  "b": ("1d", 366)},
    "5J":  {"y": ("5y", "1wk"), "b": ("1w", 261)},
    "MAX": {"y": ("max", "1mo"), "b": ("1M", 1000)},
}


def sma(werte, fenster):
    out = [None] * len(werte)
    summe = 0.0
    for i, w in enumerate(werte):
        summe += w
        if i >= fenster:
            summe -= werte[i - fenster]
        if i >= fenster - 1:
            out[i] = round(summe / fenster, 6)
    return out


def rsi(schluesse, periode=14):
    out = [None] * len(schluesse)
    if len(schluesse) <= periode:
        return out
    gewinne, verluste = [], []
    for i in range(1, len(schluesse)):
        d = schluesse[i] - schluesse[i - 1]
        gewinne.append(max(d, 0))
        verluste.append(max(-d, 0))
    g = sum(gewinne[:periode]) / periode
    v = sum(verluste[:periode]) / periode

    def wert(g, v):
        if v == 0:
            return 100.0
        return 100 - 100 / (1 + g / v)

    out[periode] = round(wert(g, v), 1)
    for i in range(periode + 1, len(schluesse)):
        g = (g * (periode - 1) + gewinne[i - 1]) / periode
        v = (v * (periode - 1) + verluste[i - 1]) / periode
        out[i] = round(wert(g, v), 1)
    return out


def kerzen_binance(symbol, range_key):
    interval, limit = RANGES[range_key]["b"]
    r = requests.get("https://api.binance.com/api/v3/klines",
                     params={"symbol": f"{symbol}USDT", "interval": interval, "limit": limit},
                     headers=UA, timeout=TIMEOUT)
    return [[[int(k[0]), float(k[1]), float(k[2]), float(k[3]), float(k[4])]
             for k in r.json()]]


def kerzen_yahoo(symbol, range_key):
    rng, interval = RANGES[range_key]["y"]
    r = requests.get(f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}",
                     params={"range": rng, "interval": interval}, headers=UA, timeout=TIMEOUT)
    j = r.json()["chart"]["result"][0]
    q = j["indicators"]["quote"][0]
    out = []
    for i, t in enumerate(j["timestamp"]):
        try:
            o, h, l, c = q["open"][i], q["high"][i], q["low"][i], q["close"][i]
            if None in (o, h, l, c):
                continue
            out.append([t * 1000, o, h, l, c])
        except (IndexError, TypeError):
            continue
    return [out]


def kerzen(symbol, range_key, ist_crypto=False, coin_id=None):
    key = f"k:{symbol}:{range_key}"
    hit = cache_get(key, 180)
    if hit:
        return hit
    try:
        if ist_crypto:
            try:
                kerzen_liste = kerzen_binance(symbol, range_key)
            except Exception:
                kerzen_liste = kerzen_coingecko(coin_id, range_key) if coin_id else []
        else:
            kerzen_liste = kerzen_yahoo(symbol, range_key)
        if not kerzen_liste or not kerzen_liste[0]:
            raise ValueError("keine Kurse")
        k = kerzen_liste[0]
        schluesse = [c[4] for c in k]
        daten = {"candles": k,
                 "sma": {"20": sma(schluesse, 20), "50": sma(schluesse, 50), "200": sma(schluesse, 200)},
                 "rsi": rsi(schluesse)}
        if range_key in ("1T", "5T"):
            daten["sma"] = {"20": sma(schluesse, 20), "50": sma(schluesse, 50), "200": [None] * len(k)}
        return cache_put(key, daten)
    except Exception as exc:
        return {"fehler": str(exc)[:120]}


def kerzen_coingecko(coin_id, range_key):
    tage = {"1T": 1, "5T": 5, "1M": 30, "3M": 90, "1J": 365, "5J": 1800, "MAX": "max"}[range_key]
    r = requests.get(f"https://api.coingecko.com/api/v3/coins/{coin_id}/market_chart",
                     params={"vs_currency": "usd", "days": tage}, headers=UA, timeout=TIMEOUT)
    preise = r.json().get("prices", [])
    kerzen = []
    for i in range(1, len(preise)):
        t, o = preise[i - 1]
        _, c = preise[i]
        hi, lo = max(o, c), min(o, c)
        kerzen.append([int(t), o, hi, lo, c])
    return [kerzen]


# ---------- News ----------
FEEDS = {
    "de": [
        ("finanzen.net", "https://www.finanzen.net/rss/news"),
        ("tagesschau", "https://www.tagesschau.de/xml/rss2/"),
        ("Handelsblatt", "https://www.handelsblatt.com/contentexport/feed/wirtschaft"),
    ],
    "en": [
        ("BBC Business", "https://feeds.bbci.co.uk/news/business/rss.xml"),
        ("CNBC", "https://www.cnbc.com/id/100003114/device/rss/rss.html"),
        ("WSJ Markets", "https://feeds.a.dj.com/rss/RSSMarketsMain.xml"),
        ("Bloomberg", "https://feeds.bloomberg.com/markets/news.rss"),
        ("Financial Times", "https://www.ft.com/rss/home"),
    ],
}

TAG_RE = re.compile(r"<[^>]+>")


def rss_lesen(name, url):
    hit = cache_get(f"feed:{url}", 600)
    if hit:
        return hit
    try:
        r = requests.get(url, headers=UA, timeout=TIMEOUT)
        wurzel = ET.fromstring(r.content)
        items = []
        for item in wurzel.iter():
            if item.tag.endswith("item") or item.tag.endswith("entry"):
                titel = link = datum = beschreibung = ""
                for kind in item:
                    tag = kind.tag.split("}")[-1]
                    if tag == "title":
                        titel = kind.text or ""
                    elif tag == "link":
                        link = (kind.text or "").strip() or next(
                            (a.get("href") for a in kind if a.tag.endswith("link")), "")
                    elif tag in ("pubDate", "published", "updated"):
                        datum = kind.text or ""
                    elif tag in ("description", "summary", "content"):
                        beschreibung = TAG_RE.sub("", kind.text or "")[:220]
                if titel:
                    items.append({"quelle": name, "titel": titel.strip(), "link": link,
                                  "zeit": datum, "text": beschreibung.strip()})
        items = items[:15]
        return cache_put(f"feed:{url}", items)
    except Exception:
        return []


def news(lang):
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = [pool.submit(rss_lesen, n, u) for n, u in FEEDS[lang]]
        quellen = []
        for (name, _url), fut in zip(FEEDS[lang], futures):
            quellen.append({"name": name, "items": fut.result()})
    return quellen


# ---------- Wirtschaftskalender ----------
KATEGORIEN = [
    ("zinsen", ["interest rate", "rate decision", "rate statement", "fomc", "ecb", "ezb",
                "boe", "boj", "fed ", "zins"]),
    ("arbeitsmarkt", ["nonfarm", "non-farm", "employment", "unemployment", "jobless",
                      "payroll", "arbeitslosen", "beschäftigung", "adu-"]),
    ("inflation", ["cpi", "inflation", "ppi", "hicp", "verbraucherpreise", "core"]),
    ("bip", ["gdp", "bip"]),
    ("konjunktur", ["pmi", "ism", "ifo", "zew", "consumer confidence", "retail sales",
                    "einkaufsmanager", "industrial", "factory orders", "durable"]),
    ("unternehmen", ["earnings", "quarterly"]),
]


def kategorie(titel):
    t = titel.lower()
    for kat, schlagworte in KATEGORIEN:
        for s in schlagworte:
            if s in t:
                return kat
    return "sonstiges"


IMPACT_MAP = {"High": "hoch", "Medium": "mittel", "Low": "niedrig", "Holiday": "feiertag"}


def kalender():
    hit = cache_get("kalender", 1800)
    if hit:
        return hit
    try:
        r = requests.get("https://nfs.faireconomy.media/ff_calendar_thisweek.xml",
                         headers=UA, timeout=TIMEOUT)
        wurzel = ET.fromstring(r.content)
        ereignisse = []
        for ev in wurzel.iter():
            if not ev.tag.endswith("event"):
                continue
            felder = {}
            for kind in ev:
                felder[kind.tag.split("}")[-1]] = (kind.text or "").strip()
            try:
                tag = datetime.strptime(felder.get("date", ""), "%m-%d-%Y")
            except ValueError:
                continue
            zeit_roh = felder.get("time", "")
            uhrzeit = None
            if zeit_roh and zeit_roh.lower() not in ("all day", "tentative", "holiday"):
                try:
                    t = datetime.strptime(zeit_roh.strip().upper(), "%I:%M%p")
                    uhrzeit = (t.hour, t.minute)
                except ValueError:
                    pass
            if uhrzeit:
                dt = tag.replace(hour=uhrzeit[0], minute=uhrzeit[1], tzinfo=ET_TZ).astimezone(BERLIN)
                zeit_anzeige = dt.strftime("%H:%M")
            else:
                dt = tag.replace(tzinfo=BERLIN)
                zeit_anzeige = "–"
            titel = felder.get("title", "")
            ereignisse.append({
                "iso": dt.date().isoformat(),
                "tag": dt.strftime("%d.%m."), "zeit": zeit_anzeige,
                "land": felder.get("country", ""), "titel": titel,
                "impact": IMPACT_MAP.get(felder.get("impact", ""), "niedrig"),
                "kategorie": kategorie(titel),
                "prognose": felder.get("forecast", ""), "vorher": felder.get("previous", ""),
                "ist": felder.get("actual", "")})
        ereignisse.sort(key=lambda e: (e["iso"], e["zeit"] == "–", e["zeit"]))
        return cache_put("kalender", ereignisse)
    except Exception:
        return []


# ---------- Routen ----------
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/heatmap")
def api_heatmap():
    return jsonify(heatmap(request.args.get("force") == "1"))


@app.route("/api/candles")
def api_candles():
    symbol = request.args.get("symbol", "")
    rng = request.args.get("range", "1M")
    if rng not in RANGES:
        rng = "1M"
    ist_crypto = request.args.get("crypto") == "1"
    coin_id = request.args.get("id")
    return jsonify(kerzen(symbol, rng, ist_crypto, coin_id))


@app.route("/api/news")
def api_news():
    lang = "en" if request.args.get("lang") == "en" else "de"
    return jsonify(news(lang))


@app.route("/api/calendar")
def api_calendar():
    return jsonify(kalender())


if __name__ == "__main__":
    import os
    app.run(debug=True, port=int(os.environ.get("PORT", 5002)))
