"""Generate static driving routes for the photography stories using OSRM."""

from collections import Counter
from bisect import bisect_left
from itertools import pairwise
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

from gen_photo_atlas_map import compact_point, simplify_line


DATA = Path(__file__).resolve().parents[1] / "data"
SERVICE = "https://router.project-osrm.org/route/v1/driving/"
MAX_BYTES = 28_000


def checked_point(value):
    if not (isinstance(value, list) and len(value) == 2 and
            all(isinstance(v, (int, float)) and math.isfinite(v) for v in value) and
            abs(value[0]) <= 180 and abs(value[1]) <= 90):
        raise ValueError(f"Invalid route coordinate: {value}")
    return value


def story_stops(story, regions):
    places = {p["name"]: p["coordinates"] for r in regions if r["id"] in story["regions"]
              for p in r["places"]}
    stops = [(entry, checked_point(entry.get("coordinates", places.get(entry["name"]))))
             for entry in story["route"]]
    if story.get("loop") and stops[0][1] != stops[-1][1]:
        stops.append(stops[0])
    return stops


def fetch_leg(points):
    coords = ";".join(f"{lon},{lat}" for lon, lat in points)
    request = urllib.request.Request(
        SERVICE + coords + "?overview=full&geometries=geojson&steps=true",
        headers={"User-Agent": "luoqi2112-photo-atlas-generator/1.0 (luoqi2112.com)"},
    )
    for attempt in range(4):
        time.sleep(1.1 if attempt == 0 else 2 ** attempt)
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                result = json.load(response)
            break
        except urllib.error.HTTPError as error:
            if attempt == 3 or (error.code != 429 and error.code < 500):
                raise
        except (urllib.error.URLError, TimeoutError):
            if attempt == 3:
                raise
    if result.get("code") != "Ok" or not result.get("routes"):
        raise ValueError(f"OSRM returned {result.get('code')}")
    return result


def major_roads(route):
    distances = Counter()
    for leg in route["legs"]:
        for step in leg["steps"]:
            ref = " / ".join(dict.fromkeys(re.findall(r"[GSX]\d+[A-Z]?", step.get("ref", ""))))
            name = step.get("name", "").strip()
            label = " ".join(filter(None, [ref, name if name != ref else ""]))
            if label and step["distance"] > 0:
                distances[label] += step["distance"]
    return [label for label, _ in distances.most_common(2)]


def sample_road(line):
    """Alternative shield positions on the same numbered road for narrow layouts."""
    distances = [0.0]
    for (x, y), (xx, yy) in pairwise(line):
        distances.append(distances[-1] + math.hypot((xx-x) * math.cos(math.radians(y)), yy-y))
    points = []
    if distances[-1]:
        for fraction in (0.5, 0.25, 0.75):
            target = distances[-1] * fraction
            i = bisect_left(distances, target)
            t = (target - distances[i-1]) / (distances[i] - distances[i-1])
            points.append(compact_point([a + t * (b-a) for a, b in zip(line[i-1], line[i])]))
    return points


def station_elevations(stops):
    """Sample the configured stops, including repeat visits but excluding the closing leg."""
    elevations = []
    try:
        for start in range(0, len(stops), 100):
            points = [point for _, point in stops[start:start + 100]]
            lat = ",".join(str(y) for x, y in points)
            lon = ",".join(str(x) for x, y in points)
            url = f"https://api.open-meteo.com/v1/elevation?latitude={lat}&longitude={lon}"
            try:
                with urllib.request.urlopen(url, timeout=12) as response:
                    result = json.load(response)
            except urllib.error.HTTPError:
                raise
            except OSError:
                # The platform TLS stack can reach the same endpoint on hosts where urllib times out.
                curl = shutil.which("curl")
                if not curl:
                    raise
                result = json.loads(subprocess.check_output(
                    [curl, "--fail", "--silent", "--max-time", "20", url], timeout=22
                ))
            values = result["elevation"]
            if len(values) != len(points) or not all(math.isfinite(v) for v in values):
                raise ValueError("Incomplete elevation sample")
            elevations.extend(round(v) for v in values)
    except (OSError, KeyError, TypeError, ValueError, subprocess.SubprocessError) as error:
        print(f"Skipping station elevations: {error}", flush=True)
        return []
    return elevations


def collect(story, regions):
    legs = []
    longest_steps = {}
    road_distances = Counter()
    total = 0
    stops = story_stops(story, regions)
    for (origin, start), (dest, end) in pairwise(stops):
        via = [checked_point(p) for p in origin.get("via", [])]
        try:
            result = fetch_leg([start, *via, end])
        except Exception as error:
            raise RuntimeError(f"{story['id']}: {origin['name']} -> {dest['name']}") from error
        route = result["routes"][0]
        for leg in route["legs"]:
            for step in leg["steps"]:
                for code in set(re.findall(r"\b[GS]\d{1,4}[A-Z]?\b", step.get("ref", ""))):
                    road_distances[code] += step["distance"]
                    if step["distance"] > longest_steps.get(code, {}).get("distance", 0):
                        longest_steps[code] = step
        geometry = route["geometry"]["coordinates"]
        if len(geometry) < 2:
            raise ValueError(f"Empty geometry at {origin['name']}")
        legs.append({"from": origin["name"], "to": dest["name"], "roads": major_roads(route),
                     "coordinates": geometry})
        total += route["distance"]
        snap = max(w["distance"] for w in result["waypoints"])
        print(f"{origin['name']} -> {dest['name']}: {route['distance']/1000:.0f} km,"
              f" max road snap {snap:.0f} m", flush=True)
    samples = stops[:-1] if story.get("loop") and stops[0][1] == stops[-1][1] else stops
    anchors = {code: sample_road(longest_steps[code]["geometry"]["coordinates"])
               for code, distance in road_distances.most_common(8) if distance > 0}
    return {"distanceKm": round(total / 1000), "elevations": station_elevations(samples),
            "roadAnchors": anchors, "legs": legs}


def encode(stories, tolerance):
    output = {"source": "OSRM / © OpenStreetMap contributors", "stories": {}}
    for key, story in stories.items():
        legs = []
        for leg in story["legs"]:
            line = leg["coordinates"]
            span = max(max(axis) - min(axis) for axis in zip(*line))
            reduced = simplify_line(line, min(tolerance, span / 25))
            legs.append({**leg, "coordinates": [compact_point(p) for p in reduced]})
        output["stories"][key] = {**story, "legs": legs}
    return json.dumps(output, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def main():
    atlas = json.loads((DATA / "config.json").read_text(encoding="utf-8"))["photos"]["atlas"]
    stories = {s["id"]: collect(s, atlas["regions"]) for s in atlas["stories"] if s.get("route")}
    for tolerance in (0.012, 0.014, 0.016, 0.018, 0.02):
        payload = encode(stories, tolerance)
        if len(payload) <= MAX_BYTES:
            break
    else:
        raise ValueError(f"Route archive exceeds {MAX_BYTES} bytes")
    target = DATA / "story-routes.json"
    with tempfile.NamedTemporaryFile(dir=DATA, delete=False) as temp:
        path = Path(temp.name)
    try:
        path.write_bytes(payload)
        path.replace(target)
    finally:
        path.unlink(missing_ok=True)
    print(f"Wrote {len(stories)} stories, {len(payload)} bytes to {target}")


if __name__ == "__main__":
    main()
