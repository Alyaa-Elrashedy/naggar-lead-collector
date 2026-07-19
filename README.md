# Naggar Lead Collector

Chrome extension for collecting LinkedIn leads into a structured CRM format (22 columns). No server needed.

## How to Install

1. Open Chrome and go to `chrome://extensions/`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked** → select the `extension` folder
4. The extension is now installed

## How to Use

### Collect Leads
- **Individual profile**: Go to any LinkedIn profile → click the blue **"Save Lead"** button below the name
- **Search results**: Go to LinkedIn People Search → click **"Save All Visible"** button (bottom-right of page)
- **Auto Discover**: Click the extension icon → **Auto Discover** tab → click any of the 58 preset search queries

### Export
- Click extension icon → **Download CSV (open in Excel)**
- CSV includes all 22 CRM columns ready for import

## What's Inside

| File | Purpose |
|------|---------|
| `extension/` | Chrome extension (load this) |
| `extension/manifest.json` | Extension config |
| `extension/content.js` | LinkedIn scraping + classification logic |
| `extension/popup.html` | Popup UI (Leads + Auto Discover tabs) |
| `extension/popup.js` | Popup logic + 58 search queries |
| `extension/styles.css` | Button styles |

## CRM Columns

date_discovered, source, profile_url, full_name, title, company_institution, location, email/Contact, linkedin_username, profile_type, pain_points_identified, value_proposition, outreach_template_used, outreach_message, outreach_status, outreach_date, follow_up_date, response, converted, revenue_potential, notes, score

## Profile Types

- `academic_researcher` — Professors, PhDs, Postdocs, Research Scientists
- `university_admin` — Deans, Directors, VPs, Department Chairs
- `global_pharma` — Biostatisticians, Clinical Trial Managers, CROs
- `partnership_target` — Co-founders, CEOs, Consortium Leaders
- `ambassador` — Graduate Students, Research Assistants

---

Built for Naggar Analytics
