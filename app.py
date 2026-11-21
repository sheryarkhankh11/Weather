"""See Weather - Flask backend that proxies Open-Meteo API calls."""
import os
import unicodedata
from functools import lru_cache
import requests
from flask import Flask, jsonify, render_template, request, abort

app = Flask(__name__)

GEOCODE_URL = "https://photon.komoot.io/api/" 
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
REVERSE_URL = "https://geocoding-api.open-meteo.com/v1/reverse"
PLACE_TYPES = (
    "country", "city", "town", "village", "hamlet", "isolated_dwelling",
    "farm", "suburb", "quarter", "neighbourhood", "locality", "borough",
    "municipality", "island",
)

WEATHER_CODES = {
    0:  {"label": "Clear sky",          "glyph": "0"},
    1:  {"label": "Mainly clear",       "glyph": "1"},
    2:  {"label": "Partly cloudy",      "glyph": "2"},
    3:  {"label": "Overcast",           "glyph": "3"},
    45: {"label": "Fog",                "glyph": "fog"},
    48: {"label": "Rime fog",           "glyph": "fog"},
    51: {"label": "Light drizzle",      "glyph": "rain"},
    53: {"label": "Drizzle",            "glyph": "rain"},
    55: {"label": "Dense drizzle",      "glyph": "rain"},
    56: {"label": "Freezing drizzle",   "glyph": "rain"},
    57: {"label": "Freezing drizzle",   "glyph": "rain"},
    61: {"label": "Slight rain",        "glyph": "rain"},
    63: {"label": "Rain",               "glyph": "rain"},
    65: {"label": "Heavy rain",         "glyph": "rain"},
    66: {"label": "Freezing rain",      "glyph": "rain"},
    67: {"label": "Freezing rain",      "glyph": "rain"},
    71: {"label": "Slight snow",        "glyph": "snow"},
    73: {"label": "Snow",               "glyph": "snow"},
    75: {"label": "Heavy snow",         "glyph": "snow"},
    77: {"label": "Snow grains",        "glyph": "snow"},
    80: {"label": "Rain showers",       "glyph": "rain"},
    81: {"label": "Rain showers",       "glyph": "rain"},
    82: {"label": "Violent showers",    "glyph": "rain"},
    85: {"label": "Snow showers",       "glyph": "snow"},
    86: {"label": "Snow showers",       "glyph": "snow"},
    95: {"label": "Thunderstorm",       "glyph": "storm"},
    96: {"label": "Thunderstorm + hail","glyph": "storm"},
    99: {"label": "Thunderstorm + hail","glyph": "storm"},
}


def code_info(c):
    return WEATHER_CODES.get(c, WEATHER_CODES[0])


@app.route("/")
def index():
    return render_template("index.html")


@lru_cache(maxsize=128)
def geocode_results(query):
    resp = requests.get(GEOCODE_URL, params={
        "q": query,
        "limit": 100,
        "lang": "en",
        "osm_tag": [f"place:{place_type}" for place_type in PLACE_TYPES],
    }, headers={"User-Agent": "SeeWheather weather app"}, timeout=10)
    resp.raise_for_status()
    matches = []
    normalized_query = _normalize_location_name(query)
    for feature in resp.json().get("features", []):
        properties = feature.get("properties", {})
        coordinates = feature.get("geometry", {}).get("coordinates", [])
        name = properties.get("name", "")
        location_type = properties.get("osm_value") or properties.get("type", "")
        if (
            properties.get("osm_key") != "place"
            or location_type not in {
                "country", "city", "town", "village", "hamlet",
                "isolated_dwelling", "farm", "suburb", "quarter",
                "neighbourhood", "locality", "borough", "municipality",
                "island",
            }
            or not name
            or not _normalize_location_name(name).startswith(normalized_query)
            or len(coordinates) < 2
        ):
            continue
        longitude, latitude = coordinates[:2]
        matches.append({
            "name": name,
            "latitude": latitude,
            "longitude": longitude,
            "admin1": properties.get("state", ""),
            "country": properties.get("country", ""),
            "country_code": properties.get("countrycode", ""),
            "feature_code": location_type,
        })
    return matches


def _normalize_location_name(value):
    normalized = unicodedata.normalize("NFKD", value.casefold())
    return "".join(char for char in normalized if not unicodedata.combining(char))


@app.route("/api/geocode")
def api_geocode():
    query = request.args.get("name", "").strip()
    if len(query) < 2:
        abort(400, "Search requires at least two characters")
    try:
        return jsonify({"results": geocode_results(query.casefold())})
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 502


@app.route("/api/reverse")
def api_reverse():
    lat = request.args.get("latitude")
    lon = request.args.get("longitude")
    if not lat or not lon:
        abort(400, "Missing latitude/longitude")
    try:
        resp = requests.get(REVERSE_URL, params={
            "latitude": lat,
            "longitude": lon,
            "count": 1,
            "language": "en",
            "format": "json",
        }, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        return jsonify({"results": data.get("results", [])})
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 502


@app.route("/api/forecast")
def api_forecast():
    lat = request.args.get("latitude")
    lon = request.args.get("longitude")
    if not lat or not lon:
        abort(400, "Missing latitude/longitude")
    try:
        resp = requests.get(FORECAST_URL, params={
            "latitude": lat,
            "longitude": lon,
            "timezone": "auto",
            "current": "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m",
            "hourly": "temperature_2m,weather_code,precipitation_probability,uv_index,visibility",
            "daily": "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,wind_speed_10m_max",
            "forecast_days": "7",
        }, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        return jsonify(data)
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 502


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)