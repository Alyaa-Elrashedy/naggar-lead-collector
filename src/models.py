from dataclasses import dataclass, field, asdict
from datetime import datetime, date
from typing import Optional
import re


LEAD_SCHEMA = [
    "date_discovered", "source", "profile_url", "full_name", "title",
    "company_institution", "location", "email/Contact", "linkedin_username",
    "profile_type", "pain_points_identified", "value_proposition",
    "outreach_template_used", "outreach_message", "outreach_status",
    "outreach_date", "follow_up_date", "response", "converted",
    "revenue_potential", "notes", "score",
]

PROFILE_TYPES = [
    "academic_researcher",
    "university_admin",
    "partnership_target",
    "ambassador",
    "global_pharma",
]

OUTREACH_TEMPLATES = [
    "researcher_cold",
    "global_biomedical_researcher",
    "academic_partnership",
    "biostruct_africa_partnership",
    "kaust_intern_connection",
    "kaust_cbrc_partnership",
    "sadat_univ_colleague",
    "pirbright_fmdv_outreach",
]

OUTREACH_STATUSES = [
    "pending", "ready_to_send", "sent", "followed_up",
    "responded", "not_interested", "converted",
]


@dataclass
class Lead:
    date_discovered: str = ""
    source: str = ""
    profile_url: str = ""
    full_name: str = ""
    title: str = ""
    company_institution: str = ""
    location: str = ""
    email_contact: str = ""
    linkedin_username: str = ""
    profile_type: str = ""
    pain_points_identified: str = ""
    value_proposition: str = ""
    outreach_template_used: str = ""
    outreach_message: str = ""
    outreach_status: str = "pending"
    outreach_date: str = ""
    follow_up_date: str = ""
    response: str = ""
    converted: bool = False
    revenue_potential: float = 0.0
    notes: str = ""
    score: int = 0

    def to_dict(self):
        d = asdict(self)
        d["email/Contact"] = d.pop("email_contact")
        return d

    @classmethod
    def from_dict(cls, d):
        if "email/Contact" in d:
            d["email_contact"] = d.pop("email/Contact")
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})

    @staticmethod
    def extract_username(url: str) -> str:
        if not url:
            return ""
        m = re.search(r"linkedin\.com/in/([^/?]+)", url)
        return m.group(1) if m else ""

    @classmethod
    def from_linkedin_url(cls, url: str, source: str = "manual") -> "Lead":
        username = cls.extract_username(url)
        return cls(
            date_discovered=date.today().isoformat(),
            source=source,
            profile_url=url,
            linkedin_username=username,
        )
