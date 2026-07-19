import re
from typing import Tuple, List

from .models import Lead

CLASSIFICATION_RULES = {
    "academic_researcher": {
        "keywords": [
            "professor", "assistant professor", "associate professor", "lecturer",
            "researcher", "phd candidate", "phd student", "postdoc",
            "postdoctoral", "scientist", "research fellow", "faculty",
            "assistant lecturer", "teaching assistant",
        ],
        "pain_points": [
            "Needs to publish in Q1 journals for promotion and university rewards",
            "No in-house biostatistics core at institution",
            "Commercial CROs charge $4,000+ per analysis — unaffordable",
            "Learning SPSS/R takes months and delays publication",
            "Publishing without proper analysis carries retraction risk",
        ],
        "value_proposition": (
            "Naggar AI: $19/analysis, 15-minute turnaround, "
            "human-expert-verified statistical reports. "
            "Bilingual (Arabic + English). University publication rewards cover the cost."
        ),
        "template": "researcher_cold",
        "score_range": (70, 95),
    },
    "university_admin": {
        "keywords": [
            "dean", "director", "head of department", "chair", "vice dean",
            "provost", "associate dean", "program director", "coordinator",
            "head of research", "institutional", "vice president research",
        ],
        "pain_points": [
            "Managing statistical support for multiple research units is resource-intensive",
            "Hiring full-time biostatisticians for short-term projects is slow and costly",
            "Institutional research output depends on faculty publication success",
            "No standardized statistical validation across labs",
        ],
        "value_proposition": (
            "Naggar Analytics enterprise licensing and institutional partnerships: "
            "university-wide access to Naggar AI with custom pricing, "
            "student ambassador program, and dedicated account management."
        ),
        "template": "academic_partnership",
        "score_range": (80, 100),
    },
    "partnership_target": {
        "keywords": [
            "co-founder", "ceo", "director", "head of", "initiative",
            "capacity building", "workshop", "training", "consortium",
            "network", "alliance", "founder", "program lead",
        ],
        "pain_points": [
            "Workshop/training participants need affordable biostatistics support to publish",
            "Building research capacity requires accessible tools for trainees",
            "Partners need reliable, scalable analytics for program participants",
        ],
        "value_proposition": (
            "Strategic partnership: integrate Naggar AI into training programs "
            "with custom discounted packages for participants. "
            "Co-branded workshops and referral program."
        ),
        "template": "biostruct_africa_partnership",
        "score_range": (85, 100),
    },
    "ambassador": {
        "keywords": [
            "student", "master", "undergraduate", "graduate",
            "intern", "trainee", "fellow", "research assistant",
        ],
        "pain_points": [
            "Learning statistical analysis from scratch is time-consuming",
            "Limited budget for professional statistical services",
            "Needs guidance on selecting correct statistical tests",
        ],
        "value_proposition": (
            "Naggar AI student ambassador program: free/discounted platform access, "
            "guided statistical logic walkthrough, and referral bonuses."
        ),
        "template": "researcher_cold",
        "score_range": (40, 70),
    },
    "global_pharma": {
        "keywords": [
            "biostatistician", "clinical trial", "pharma", "pharmaceutical",
            "cro", "contract research", "biotech", "medical affairs",
            "regulatory", "fda", "clinical research",
        ],
        "pain_points": [
            "In-house biostatistics team at full capacity",
            "Delayed analysis slows down pilot studies and publications",
            "Need FDA/regulatory-compliant statistical reporting",
        ],
        "value_proposition": (
            "Naggar Analytics consulting overflow: high-end human-in-the-loop "
            "biostatistics that meet FDA and clinical trial standards "
            "for pilot studies and secondary analyses."
        ),
        "template": "global_biomedical_researcher",
        "score_range": (70, 95),
    },
}


def classify_title(title: str) -> str:
    if not title:
        return "academic_researcher"
    title_lower = title.lower()

    best_type = "academic_researcher"
    best_rank = -1

    for ptype, rules in CLASSIFICATION_RULES.items():
        for i, kw in enumerate(rules["keywords"]):
            if kw in title_lower:
                rank = len(kw)  # longer match = more specific
                if rank > best_rank:
                    best_rank = rank
                    best_type = ptype

    return best_type


def get_pain_points(profile_type: str) -> List[str]:
    rules = CLASSIFICATION_RULES.get(profile_type, CLASSIFICATION_RULES["academic_researcher"])
    return rules["pain_points"]


def get_value_proposition(profile_type: str) -> str:
    rules = CLASSIFICATION_RULES.get(profile_type, CLASSIFICATION_RULES["academic_researcher"])
    return rules["value_proposition"]


def get_template(profile_type: str) -> str:
    rules = CLASSIFICATION_RULES.get(profile_type, CLASSIFICATION_RULES["academic_researcher"])
    return rules["template"]


def score_lead(profile_type: str, title: str = "", company: str = "") -> int:
    rules = CLASSIFICATION_RULES.get(profile_type, CLASSIFICATION_RULES["academic_researcher"])
    low, high = rules["score_range"]

    base = (low + high) // 2

    if company:
        boost = 0
        prestige_keywords = ["university", "institute", "kaust", "mayo", "johns hopkins",
                            "harvard", "oxford", "cambridge", "mit", "stanford"]
        for kw in prestige_keywords:
            if kw in company.lower():
                boost = 10
                break
        base = min(base + boost, high)

    return base


def enrich_lead(lead: Lead) -> Lead:
    if not lead.profile_type:
        lead.profile_type = classify_title(lead.title)

    if not lead.pain_points_identified:
        lead.pain_points_identified = "\n".join(get_pain_points(lead.profile_type))

    if not lead.value_proposition:
        lead.value_proposition = get_value_proposition(lead.profile_type)

    if not lead.outreach_template_used:
        lead.outreach_template_used = get_template(lead.profile_type)

    if lead.score == 0:
        lead.score = score_lead(lead.profile_type, lead.title, lead.company_institution)

    return lead
