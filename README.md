# Naggar Lead Collector

Chrome extension for collecting LinkedIn leads into a structured CRM format (22 columns). No server needed.

## How to Install

1. Open Chrome and go to `chrome://extensions/`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked** → select the `extension` folder
4. The extension is now installed

## How to Use

### Collect Leads
- **On LinkedIn**: Go to any profile → click **"Save Lead"** (bottom-right). Or search people → click **"Save All Visible"**
- **By URL**: Click extension → **Settings** → paste a profile URL → **Add Lead** (adds to My Leads directly)
- **Auto Discover**: Click extension → **Auto Discover** → click any preset search → LinkedIn opens → click **"Save All Visible"**
- **Custom searches**: Click extension → **Settings** → paste any LinkedIn People Search URL → **Add** (appears in Auto Discover)

### Manage Leads
- Click extension → **My Leads**: view all leads, see type breakdown, delete individual leads
- **Settings**: import/export JSON backup, clear all

### Export
- Click extension → **My Leads** → **Download CSV** → open in Excel
- CSV includes all 22 CRM columns ready for import

## What's Inside

| File | Purpose |
|------|---------|
| `extension/` | Chrome extension (load this) |
| `extension/manifest.json` | Extension config |
| `extension/content.js` | LinkedIn scraping + classification logic |
| `extension/popup.html` | Popup UI (My Leads + Auto Discover + Settings tabs) |
| `extension/popup.js` | Popup logic + search queries |
| `extension/styles.css` | Button styles |
| `extension/background.js` | Badge counter service worker |

## CRM Columns

date_discovered, source, profile_url, full_name, title, company_institution, location, email/Contact, linkedin_username, profile_type, pain_points_identified, value_proposition, outreach_template_used, outreach_message, outreach_status, outreach_date, follow_up_date, response, converted, revenue_potential, notes, score

## Profile Types

- `academic_researcher` — Professors, PhDs, Postdocs, Research Scientists, Bioinformaticians, Data Scientists
- `university_admin` — Deans, Directors, VPs, Department Chairs
- `global_pharma` — Biostatisticians, Clinical Trial Managers, CROs, Bioinformaticians
- `partnership_target` — Co-founders, CEOs, Consortium Leaders, Freelancers, Consultants
- `ambassador` — Graduate Students, Research Assistants, Interns

---

Built for Naggar Analytics
