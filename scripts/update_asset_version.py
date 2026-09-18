#!/usr/bin/env python3
"""Keep static asset query versions consistent across the site."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VERSION_FILE = ROOT / ".asset-version"
TEXT_SUFFIXES = {".html", ".css", ".js", ".json"}
VERSION_RE = re.compile(r"(?P<prefix>[?&]v=)(?P<version>[A-Za-z0-9._-]+)")
LOCAL_IMPORT_RE = re.compile(
    r"\bfrom\s+['\"](?P<path>\./[^'\"]+\.js)(?P<query>[^'\"]*)['\"]"
)
VALID_VERSION_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
SKIP_PARTS = {".git", ".codex", "node_modules"}


def iter_text_files() -> list[Path]:
    return sorted(
        path
        for path in ROOT.rglob("*")
        if path.is_file()
        and path.suffix.lower() in TEXT_SUFFIXES
        and not any(part in SKIP_PARTS for part in path.parts)
    )


def read_version() -> str:
    version = VERSION_FILE.read_text(encoding="utf-8").strip()
    if not VALID_VERSION_RE.fullmatch(version):
        raise ValueError(f"Invalid asset version in {VERSION_FILE.name}: {version!r}")
    return version


def check(expected: str) -> int:
    errors: list[str] = []
    versioned_refs = 0

    for path in iter_text_files():
        text = path.read_text(encoding="utf-8")
        relative = path.relative_to(ROOT)
        if "\ufffd" in text:
            errors.append(f"{relative}: contains U+FFFD replacement character")
        for match in VERSION_RE.finditer(text):
            versioned_refs += 1
            if match.group("version") != expected:
                errors.append(
                    f"{relative}: expected ?v={expected}, found ?v={match.group('version')}"
                )
        if path.suffix.lower() == ".js":
            for match in LOCAL_IMPORT_RE.finditer(text):
                if f"v={expected}" not in match.group("query"):
                    errors.append(
                        f"{relative}: local import is not versioned: {match.group('path')}"
                    )

    if versioned_refs == 0:
        errors.append("No versioned asset references were found")

    if errors:
        print("Static asset validation failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(f"Validated {versioned_refs} versioned references with ?v={expected}.")
    return 0


def update(version: str) -> int:
    if not VALID_VERSION_RE.fullmatch(version):
        print(f"Invalid asset version: {version!r}", file=sys.stderr)
        return 2

    changed: list[Path] = []
    for path in iter_text_files():
        text = path.read_text(encoding="utf-8")
        updated = VERSION_RE.sub(lambda match: f"{match.group('prefix')}{version}", text)
        if updated != text:
            path.write_text(updated, encoding="utf-8", newline="\n")
            changed.append(path.relative_to(ROOT))

    VERSION_FILE.write_text(f"{version}\n", encoding="utf-8", newline="\n")
    print(f"Updated {len(changed)} files to ?v={version}.")
    for path in changed:
        print(f"- {path}")
    return check(version)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("version", nargs="?", help="new version token")
    parser.add_argument(
        "--check",
        action="store_true",
        help="validate references against .asset-version without changing files",
    )
    args = parser.parse_args()

    if args.check and args.version:
        parser.error("--check does not accept a version argument")
    if args.check:
        try:
            return check(read_version())
        except (OSError, ValueError) as exc:
            print(exc, file=sys.stderr)
            return 2
    if not args.version:
        parser.error("provide a version token or use --check")
    return update(args.version)


if __name__ == "__main__":
    raise SystemExit(main())
