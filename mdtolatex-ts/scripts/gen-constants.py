#!/usr/bin/env python3
"""Regenerates packages/core/src/latex/constants.ts from the original
src/logic/latex_constants.py, so the LaTeX boilerplate has a single source
of truth while both implementations coexist.

Usage (from the ts/ directory):  python3 scripts/gen-constants.py
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC = ROOT / "src" / "logic" / "latex_constants.py"
DST = ROOT / "ts" / "packages" / "core" / "src" / "latex" / "constants.ts"

source = SRC.read_text(encoding="utf-8").replace("\r\n", "\n")
pattern = re.compile(r'^(\w+)\s*=\s*r"""(.*?)"""', re.S | re.M)

lines = [
    "// AUTO-GENERATED from src/logic/latex_constants.py — do not hand-edit.",
    "// Regenerate with: python3 scripts/gen-constants.py",
    "",
]
for match in pattern.finditer(source):
    name, body = match.group(1), match.group(2)
    escaped = body.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")
    lines.append(f"export const {name} = `{escaped}`;\n")

DST.write_text("\n".join(lines), encoding="utf-8")
print(f"wrote {DST.relative_to(ROOT)}")
