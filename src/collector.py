import csv
import re
from pathlib import Path
from typing import List, Optional

from .models import Lead


def parse_urls_from_text(text: str) -> List[str]:
    urls = re.findall(r"https?://(?:www\.)?linkedin\.com/in/[^/\s]+", text)
    return list(set(urls))


def read_urls_from_file(path: str) -> List[str]:
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    return parse_urls_from_text(text)


def parse_sales_navigator_csv(path: str) -> List[Lead]:
    leads = []
    with open(path, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            url = row.get("LinkedIn URL", row.get("Profile URL", row.get("URL", "")))
            username = Lead.extract_username(url)
            lead = Lead(
                date_discovered=row.get("Date Discovered", ""),
                source="sales_navigator",
                profile_url=url,
                full_name=row.get("Full Name", row.get("Name", row.get("First Name", "") + " " + row.get("Last Name", ""))).strip(),
                title=row.get("Headline", row.get("Title", row.get("Position", ""))),
                company_institution=row.get("Company", row.get("Account Name", "")),
                location=row.get("Location", row.get("Geography", "")),
                email_contact=row.get("Email", row.get("Email Address", "")),
                linkedin_username=username,
            )
            leads.append(lead)
    return leads


def build_lead_from_url(url: str, source: str = "manual") -> Lead:
    return Lead.from_linkedin_url(url, source=source)
