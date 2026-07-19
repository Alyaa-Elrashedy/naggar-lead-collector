from typing import Optional
from .models import Lead

TEMPLATES = {
    "researcher_cold": (
        "Dear {title} {last_name},\n\n"
        "I came across your profile and was impressed by your work in {field}.\n\n"
        "I'm reaching out from Naggar Analytics, a research support platform built "
        "specifically for academics like you. We help researchers get their "
        "statistical analysis right — fast and affordably.\n\n"
        "Our platform Naggar AI delivers:\n"
        "- Complete statistical analysis in 15 minutes\n"
        "- Human expert verification on every report\n"
        "- Bilingual support (Arabic + English)\n"
        "- Pricing from just $19 per analysis\n\n"
        "Given your work in {field}, I believe our platform could save you weeks "
        "of waiting and thousands of dollars in consulting fees.\n\n"
        "Would you be open to a 10-minute call to see if this fits your needs?\n\n"
        "Best regards,\nDr. Noora Noureldin\nHead of Public Relations\nNaggar Analytics"
    ),
    "global_biomedical_researcher": (
        "Dear {title} {last_name},\n\n"
        "I hope you are having a productive week. I came across your publications "
        "on {field}, which I found highly relevant to my own research.\n\n"
        "I am writing to introduce Naggar Analytics. We support researchers with "
        "rapid, high-quality biostatistical consulting and publication-ready tables. "
        "Our model combines advanced statistical workflows with senior human "
        "verification to ensure journal and regulatory compliance.\n\n"
        "We would be delighted to act as an overflow partner for your lab's "
        "pilot studies and secondary data analyses.\n\n"
        "Best regards,\nDr. Alyaa Elrashedy\nFMDV & Infectious Diseases Researcher"
    ),
    "academic_partnership": (
        "Dear {title} {last_name},\n\n"
        "I hope this message finds you well. As a {title} at {company}, "
        "you understand the challenge of providing statistical support across "
        "multiple research projects.\n\n"
        "I am writing from Naggar Analytics. We offer enterprise licensing of "
        "Naggar AI — a deterministic statistical engine combined with human "
        "expert review. It enables researchers to generate publication-grade "
        "statistical analysis in 15 minutes.\n\n"
        "We have a Student Ambassador Program and would love to discuss a "
        "university-wide partnership.\n\n"
        "Best regards,\nDr. Noora Noureldin\nHead of Public Relations\nNaggar Analytics"
    ),
    "biostruct_africa_partnership": (
        "Dear {title} {last_name},\n\n"
        "I hope this message finds you well. I am deeply inspired by your work "
        "in building research capacity in Africa through {company}.\n\n"
        "I am collaborating with Naggar Analytics, which offers Naggar AI — "
        "automating standard research data analysis in 15 minutes with "
        "human-verified expert review, starting at just $19 per analysis.\n\n"
        "I believe there is a great opportunity to partner by integrating "
        "Naggar AI into your training programs.\n\n"
        "Would you be open to a brief chat to explore this?\n\n"
        "Best regards,\nDr. Alyaa Elrashedy\nAssistant Lecturer & FMDV Researcher"
    ),
    "kaust_intern_connection": (
        "Dear {title} {last_name},\n\n"
        "I hope you are having a productive week. As an intern in your lab, "
        "I have been learning immensely from the team's rigorous approach.\n\n"
        "In our research, we generate extensive datasets that require "
        "sophisticated biostatistical modeling. I wanted to share a resource "
        "I work with: Naggar Analytics. They specialize in biostatistics for "
        "health research, fusing AI speed with senior biostatistician "
        "human verification.\n\n"
        "I'd love to share more about their work if you have a few minutes.\n\n"
        "Best regards,\nDr. Alyaa Elrashedy\nIntern, {company}"
    ),
}


def extract_last_name(full_name: str) -> str:
    if not full_name:
        return ""
    parts = full_name.strip().split()
    return parts[-1] if len(parts) > 1 else ""


def extract_field(title: str) -> str:
    if not title:
        return "research"
    title_lower = title.lower()
    field_keywords = {
        "bioinformatics": "bioinformatics",
        "biostatistic": "biostatistics",
        "epidemiolog": "epidemiology",
        "genomic": "genomics",
        "molecular": "molecular biology",
        "immunolog": "immunology",
        "pharma": "pharmaceutical research",
        "clinical": "clinical research",
        "computational": "computational biology",
        "data scien": "data science",
        "structural biolog": "structural biology",
        "microbiolog": "microbiology",
        "virolog": "virology",
        "vaccine": "vaccine research",
        "cancer": "oncology",
        "neurolog": "neurology",
        "cardio": "cardiology",
        "public health": "public health",
        "statistics": "applied statistics",
        "biotechnology": "biotechnology",
    }
    for kw, field in field_keywords.items():
        if kw in title_lower:
            return field
    return "academic research"


def generate_message(lead: Lead) -> str:
    template_key = lead.outreach_template_used or "researcher_cold"
    template = TEMPLATES.get(template_key, TEMPLATES["researcher_cold"])

    last_name = extract_last_name(lead.full_name)
    field = extract_field(lead.title)

    try:
        return template.format(
            title=("Dr." if lead.full_name else ""),
            last_name=last_name,
            company=lead.company_institution or "your institution",
            field=field,
        )
    except KeyError:
        return TEMPLATES["researcher_cold"].format(
            title="Dr.", last_name=last_name, field=field
        )
