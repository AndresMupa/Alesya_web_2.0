"""Convert the Alesya school workbook into the JSON accepted by import-school-leads.mjs."""

import json
import re
import sys
from datetime import date, datetime
from pathlib import Path

import openpyxl


def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: python scripts/prepare-school-leads.py input.xlsx output.json")
    source, target = map(Path, sys.argv[1:])
    workbook = openpyxl.load_workbook(source, read_only=True, data_only=True)
    rows = iter(workbook["Leads activos"].values)
    for _ in range(4):
        next(rows)

    records = []
    seen = set()
    for row in rows:
        organization = str(row[6] or "").strip()
        external_id = str(row[7] or "").strip()
        if not organization or not external_id:
            continue
        if external_id in seen:
            raise ValueError(f"Duplicate DANE code: {external_id}")
        seen.add(external_id)
        email_text = str(row[18] or "")
        email_match = re.search(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", email_text)
        website = str(row[21] or "").strip() or None
        if website and not website.startswith(("http://", "https://")):
            website = "https://" + website
        priority = {"Alta": "high", "Media": "medium", "Baja": "low"}.get(str(row[1] or "").strip(), "medium")

        def as_date(value):
            return value.date().isoformat() if isinstance(value, datetime) else value.isoformat() if isinstance(value, date) else None

        records.append({
            "externalId": external_id,
            "organization": organization,
            "name": str(row[22] or "Equipo directivo").strip(),
            "email": email_match.group(0).lower() if email_match else None,
            "phone": str(row[17] or "").strip() or None,
            "city": str(row[4] or "").strip().title() or None,
            "priority": priority,
            "website": website,
            "owner": str(row[31] or "").strip() or None,
            "lastContact": as_date(row[32]),
            "nextFollowUp": as_date(row[33]),
            "notes": str(row[34] or "").strip()[:4000],
        })
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(records, ensure_ascii=False), encoding="utf-8")
    print(f"Prepared {len(records)} unique school records.")


if __name__ == "__main__":
    main()
