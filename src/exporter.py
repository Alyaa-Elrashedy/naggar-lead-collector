from pathlib import Path
from typing import List, Optional

import pandas as pd

from .models import LEAD_SCHEMA, Lead


def read_leads(path: str) -> pd.DataFrame:
    p = Path(path)
    if not p.exists():
        return pd.DataFrame(columns=LEAD_SCHEMA)
    df = pd.read_excel(path, engine="openpyxl")
    for col in LEAD_SCHEMA:
        if col not in df.columns:
            df[col] = ""
    return df[LEAD_SCHEMA]


def append_leads(path: str, leads: List[Lead]) -> int:
    df = read_leads(path)
    new_records = [l.to_dict() for l in leads]
    df_new = pd.DataFrame(new_records, columns=LEAD_SCHEMA)
    df = pd.concat([df, df_new], ignore_index=True)
    df.to_excel(path, index=False, engine="openpyxl")
    return len(new_records)


def write_leads(path: str, leads: List[Lead]) -> int:
    records = [l.to_dict() for l in leads]
    df = pd.DataFrame(records, columns=LEAD_SCHEMA)
    df.to_excel(path, index=False, engine="openpyxl")
    return len(leads)


def merge_leads(path: str, leads: List[Lead]) -> int:
    df = read_leads(path)
    existing_urls = set(df["profile_url"].dropna().tolist())

    new_records = [l.to_dict() for l in leads if l.profile_url not in existing_urls]
    if new_records:
        df_new = pd.DataFrame(new_records, columns=LEAD_SCHEMA)
        df = pd.concat([df, df_new], ignore_index=True)
        df.to_excel(path, index=False, engine="openpyxl")

    return len(new_records)
