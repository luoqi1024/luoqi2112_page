#!/usr/bin/env python3
"""Generate a compact province-level GeoJSON file for the photography atlas."""

from __future__ import annotations

import json
import math
import urllib.request
from pathlib import Path


SOURCE_URL = "https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json"
OUTPUT_PATH = Path(__file__).resolve().parents[1] / "data" / "china-provinces.geojson"
SIMPLIFY_TOLERANCE = 0.025


def point_segment_distance(point, start, end):
    px, py = point
    sx, sy = start
    ex, ey = end
    dx = ex - sx
    dy = ey - sy
    if dx == 0 and dy == 0:
        return math.hypot(px - sx, py - sy)
    ratio = max(0.0, min(1.0, ((px - sx) * dx + (py - sy) * dy) / (dx * dx + dy * dy)))
    nearest_x = sx + ratio * dx
    nearest_y = sy + ratio * dy
    return math.hypot(px - nearest_x, py - nearest_y)


def simplify_line(points, tolerance):
    if len(points) <= 2:
        return points

    max_distance = 0.0
    max_index = 0
    for index in range(1, len(points) - 1):
        distance = point_segment_distance(points[index], points[0], points[-1])
        if distance > max_distance:
            max_distance = distance
            max_index = index

    if max_distance <= tolerance:
        return [points[0], points[-1]]

    left = simplify_line(points[: max_index + 1], tolerance)
    right = simplify_line(points[max_index:], tolerance)
    return left[:-1] + right


def simplify_ring(ring):
    if len(ring) < 4:
        return ring
    open_ring = ring[:-1] if ring[0] == ring[-1] else ring
    simplified = simplify_line(open_ring + [open_ring[0]], SIMPLIFY_TOLERANCE)
    if len(simplified) < 4:
        return ring
    return simplified


def compact_point(point):
    return [round(float(point[0]), 4), round(float(point[1]), 4)]


def compact_ring(ring):
    return [compact_point(point) for point in simplify_ring(ring)]


def compact_geometry(geometry):
    geometry_type = geometry.get("type")
    coordinates = geometry.get("coordinates", [])
    if geometry_type == "Polygon":
        compacted = [compact_ring(ring) for ring in coordinates]
    elif geometry_type == "MultiPolygon":
        compacted = [[compact_ring(ring) for ring in polygon] for polygon in coordinates]
    else:
        raise ValueError(f"Unsupported geometry type: {geometry_type}")
    return {"type": geometry_type, "coordinates": compacted}


def main():
    request = urllib.request.Request(
        SOURCE_URL,
        headers={"User-Agent": "luoqi2112-photo-atlas-generator/1.0"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        source = json.load(response)

    features = []
    for feature in source.get("features", []):
        properties = feature.get("properties", {})
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "adcode": properties.get("adcode"),
                    "name": properties.get("name"),
                    "center": properties.get("center"),
                    "centroid": properties.get("centroid"),
                },
                "geometry": compact_geometry(feature.get("geometry", {})),
            }
        )

    output = {
        "type": "FeatureCollection",
        "source": SOURCE_URL,
        "features": features,
    }
    OUTPUT_PATH.write_text(
        json.dumps(output, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"Wrote {len(features)} province features to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
