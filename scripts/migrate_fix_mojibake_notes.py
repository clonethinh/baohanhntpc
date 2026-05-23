#!/usr/bin/env python3
"""Fix common mojibake Vietnamese strings stored in api/db.json.

This migrates data in-place but writes a timestamped backup first.

Safe-ish rules:
- only performs a small set of exact substring replacements
- only touches warranty history notes and leaves other fields intact
"""

from __future__ import annotations

import json
import shutil
from datetime import datetime
from pathlib import Path


REPLACEMENTS = [
    # Supplier send/return notes (known broken literals from previous code)
    ("\ufffd\ufffd g?i b?o h\ufffdnh nh\ufffd cung c?p:", "Đã gửi bảo hành nhà cung cấp:"),
    ("\ufffd\ufffd nh?n l?i t? nh\ufffd cung c?p:", "Đã nhận lại từ nhà cung cấp:"),
    # Alternate mojibake variants seen in code
    ("Ðã g?i b?o hành nhà cung c?p:", "Đã gửi bảo hành nhà cung cấp:"),
    ("Ðã nh?n l?i t? nhà cung c?p:", "Đã nhận lại từ nhà cung cấp:"),
    # Other common ones already handled in UI, but clean in DB too
    ("Import t\u00e1\u00bb\u00ab Excel", "Import từ Excel"),
    ("X\u00c3\u00b3a m\u00e1\u00bb\x81m", "Xóa mềm"),
]


def apply_replacements(s: str) -> tuple[str, int]:
    changed = 0
    out = s
    for old, new in REPLACEMENTS:
        if old in out:
            out = out.replace(old, new)
            changed += 1
    return out, changed


def main() -> int:
    db_path = Path("api") / "db.json"
    if not db_path.exists():
        raise SystemExit(f"Not found: {db_path}")

    backup_path = db_path.with_suffix(f".json.bak.{datetime.now().strftime('%Y%m%d-%H%M%S')}")
    shutil.copy2(db_path, backup_path)

    raw = db_path.read_text(encoding="utf-8")
    db = json.loads(raw)

    warranties = db.get("warranties") or []

    touched_notes = 0
    total_repl_hits = 0

    for w in warranties:
        history = w.get("history") or []
        for h in history:
            note = h.get("note")
            if not isinstance(note, str) or not note:
                continue
            fixed, hits = apply_replacements(note)
            if hits:
                h["note"] = fixed
                touched_notes += 1
                total_repl_hits += hits

    db_path.write_text(json.dumps(db, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Backup: {backup_path}")
    print(f"Updated notes: {touched_notes}")
    print(f"Replacement hits: {total_repl_hits}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
