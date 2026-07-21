// === Naggar Lead Collector - Standalone Extension ===
// No server needed. Saves leads to browser storage, exports as CSV.

const STORAGE_KEY = "naggar_leads";
const QUERIES_KEY = "naggar_queries";

// ─── 58 Predefined Search Queries ───
const SEARCH_QUERIES = [
  // Academic Researchers
  { label: "Professors - Biostatistics", url: "https://www.linkedin.com/search/results/people/?keywords=biostatistics%20professor" },
  { label: "Professors - Epidemiology", url: "https://www.linkedin.com/search/results/people/?keywords=epidemiology%20professor" },
  { label: "Professors - Public Health", url: "https://www.linkedin.com/search/results/people/?keywords=public%20health%20professor" },
  { label: "PhD Candidates - Biostatistics", url: "https://www.linkedin.com/search/results/people/?keywords=biostatistics%20PhD%20candidate" },
  { label: "PhD Candidates - Epidemiology", url: "https://www.linkedin.com/search/results/people/?keywords=epidemiology%20PhD%20candidate" },
  { label: "Postdoctoral Researchers", url: "https://www.linkedin.com/search/results/people/?keywords=postdoctoral%20researcher%20biostatistics" },
  { label: "Research Scientists - Bioinformatics", url: "https://www.linkedin.com/search/results/people/?keywords=bioinformatics%20research%20scientist" },
  { label: "Research Scientists - Data Science", url: "https://www.linkedin.com/search/results/people/?keywords=data%20science%20research%20scientist" },
  { label: "Medical Researchers", url: "https://www.linkedin.com/search/results/people/?keywords=medical%20researcher" },
  { label: "Clinical Researchers", url: "https://www.linkedin.com/search/results/people/?keywords=clinical%20researcher" },
  // University Admin
  { label: "Deans - Research", url: "https://www.linkedin.com/search/results/people/?keywords=dean%20of%20research" },
  { label: "Vice Deans - Graduate Studies", url: "https://www.linkedin.com/search/results/people/?keywords=vice%20dean%20graduate%20studies" },
  { label: "Research Center Directors", url: "https://www.linkedin.com/search/results/people/?keywords=research%20center%20director" },
  { label: "Vice Presidents - Research", url: "https://www.linkedin.com/search/results/people/?keywords=vice%20president%20research%20university" },
  { label: "Lab Directors", url: "https://www.linkedin.com/search/results/people/?keywords=lab%20director%20university" },
  { label: "Department Chairs", url: "https://www.linkedin.com/search/results/people/?keywords=department%20chair%20biostatistics" },
  { label: "Program Coordinators - Research", url: "https://www.linkedin.com/search/results/people/?keywords=research%20program%20coordinator" },
  { label: "Research Development Officers", url: "https://www.linkedin.com/search/results/people/?keywords=research%20development%20officer" },
  // Global Pharma & Biotech
  { label: "Biostatisticians - Pharma", url: "https://www.linkedin.com/search/results/people/?keywords=biostatistician%20pharmaceutical" },
  { label: "Clinical Trial Managers", url: "https://www.linkedin.com/search/results/people/?keywords=clinical%20trial%20manager" },
  { label: "Clinical Research Associates", url: "https://www.linkedin.com/search/results/people/?keywords=clinical%20research%20associate" },
  { label: "Medical Affairs Directors", url: "https://www.linkedin.com/search/results/people/?keywords=medical%20affairs%20director" },
  { label: "Regulatory Affairs - Biostatistics", url: "https://www.linkedin.com/search/results/people/?keywords=regulatory%20affairs%20biostatistics" },
  { label: "CRO - Business Development", url: "https://www.linkedin.com/search/results/people/?keywords=CRO%20business%20development" },
  { label: "Pharma R&D Managers", url: "https://www.linkedin.com/search/results/people/?keywords=pharma%20R%26D%20manager" },
  { label: "Biotech Founders", url: "https://www.linkedin.com/search/results/people/?keywords=biotech%20founder" },
  { label: "Biostatistics Directors", url: "https://www.linkedin.com/search/results/people/?keywords=director%20biostatistics" },
  { label: "Data Management - Clinical", url: "https://www.linkedin.com/search/results/people/?keywords=clinical%20data%20management" },
  // Partnership Targets
  { label: "Co-Founders - HealthTech", url: "https://www.linkedin.com/search/results/people/?keywords=healthtech%20co-founder" },
  { label: "CEOs - Research Services", url: "https://www.linkedin.com/search/results/people/?keywords=CEO%20research%20services" },
  { label: "Founders - EdTech", url: "https://www.linkedin.com/search/results/people/?keywords=edtech%20founder" },
  { label: "Capacity Building - Research", url: "https://www.linkedin.com/search/results/people/?keywords=research%20capacity%20building" },
  { label: "Training Directors - Research", url: "https://www.linkedin.com/search/results/people/?keywords=research%20training%20director" },
  { label: "Consortium Leaders", url: "https://www.linkedin.com/search/results/people/?keywords=research%20consortium%20leader" },
  { label: "Workshop Organizers - Research", url: "https://www.linkedin.com/search/results/people/?keywords=research%20workshop%20organizer" },
  { label: "Innovation Center Directors", url: "https://www.linkedin.com/search/results/people/?keywords=innovation%20center%20director" },
  { label: "Science Park Managers", url: "https://www.linkedin.com/search/results/people/?keywords=science%20park%20manager" },
  // Location-Specific (Saudi Arabia)
  { label: "Saudi Arabia - Professors", url: "https://www.linkedin.com/search/results/people/?keywords=professor&geoUrn=101282733" },
  { label: "Saudi Arabia - Researchers", url: "https://www.linkedin.com/search/results/people/?keywords=researcher&geoUrn=101282733" },
  { label: "Saudi Arabia - PhD", url: "https://www.linkedin.com/search/results/people/?keywords=PhD%20candidate&geoUrn=101282733" },
  { label: "KAUST - Researchers", url: "https://www.linkedin.com/search/results/people/?keywords=KAUST%20researcher" },
  // Location-Specific (UAE)
  { label: "UAE - Professors", url: "https://www.linkedin.com/search/results/people/?keywords=professor&geoUrn=101194590" },
  { label: "UAE - Researchers", url: "https://www.linkedin.com/search/results/people/?keywords=researcher&geoUrn=101194590" },
  { label: "UAE - PhD", url: "https://www.linkedin.com/search/results/people/?keywords=PhD%20candidate&geoUrn=101194590" },
  // Location-Specific (Egypt)
  { label: "Egypt - Professors", url: "https://www.linkedin.com/search/results/people/?keywords=professor&geoUrn=102100715" },
  { label: "Egypt - Researchers", url: "https://www.linkedin.com/search/results/people/?keywords=researcher&geoUrn=102100715" },
  { label: "Egypt - PhD", url: "https://www.linkedin.com/search/results/people/?keywords=PhD%20candidate&geoUrn=102100715" },
  // Location-Specific (USA)
  { label: "USA - Biostatistics Professors", url: "https://www.linkedin.com/search/results/people/?keywords=biostatistics%20professor&geoUrn=103644278" },
  { label: "USA - Epidemiology Researchers", url: "https://www.linkedin.com/search/results/people/?keywords=epidemiology%20researcher&geoUrn=103644278" },
  { label: "USA - Public Health Researchers", url: "https://www.linkedin.com/search/results/people/?keywords=public%20health%20researcher&geoUrn=103644278" },
  // Location-Specific (UK)
  { label: "UK - Biostatistics Researchers", url: "https://www.linkedin.com/search/results/people/?keywords=biostatistics%20researcher&geoUrn=101165590" },
  { label: "UK - Epidemiology Researchers", url: "https://www.linkedin.com/search/results/people/?keywords=epidemiology%20researcher&geoUrn=101165590" },
  { label: "UK - Public Health", url: "https://www.linkedin.com/search/results/people/?keywords=public%20health%20researcher&geoUrn=101165590" },
  // Location-Specific (Germany)
  { label: "Germany - Researchers", url: "https://www.linkedin.com/search/results/people/?keywords=researcher&geoUrn=101282230" },
  { label: "Germany - Biostatistics", url: "https://www.linkedin.com/search/results/people/?keywords=biostatistics&geoUrn=101282230" },
  // Ambassadors / Students
  { label: "Graduate Students - Biostatistics", url: "https://www.linkedin.com/search/results/people/?keywords=master%20student%20biostatistics" },
  { label: "Research Assistants", url: "https://www.linkedin.com/search/results/people/?keywords=research%20assistant%20biostatistics" },
  { label: "Teaching Assistants - Statistics", url: "https://www.linkedin.com/search/results/people/?keywords=teaching%20assistant%20statistics" },
  // New roles
  { label: "Bioinformaticians", url: "https://www.linkedin.com/search/results/people/?keywords=bioinformatician" },
  { label: "Freelance Biostatisticians", url: "https://www.linkedin.com/search/results/people/?keywords=freelancer%20biostatistician" },
  { label: "Data Scientists - Research", url: "https://www.linkedin.com/search/results/people/?keywords=data%20scientist%20research" },
  { label: "Consultants - Biostatistics", url: "https://www.linkedin.com/search/results/people/?keywords=biostatistics%20consultant" },
  { label: "Bioinformatics Students", url: "https://www.linkedin.com/search/results/people/?keywords=bioinformatics%20student" },
];

// ─── Classification rules ───
const PROFILE_RULES = {
  academic_researcher: {
    keywords: ["professor", "lecturer", "researcher", "phd", "postdoc", "postdoctoral", "scientist", "faculty", "teaching assistant", "fellow", "phd candidate", "phd student", "bioinformatician", "data scientist"],
    pain_points: "Needs to publish in Q1 journals for promotion. No in-house biostatistics core. Commercial CROs charge $4,000+ per analysis. Learning SPSS/R takes months.",
    value_prop: "Naggar AI: $19/analysis, 15-min turnaround, human-verified statistical reports. Bilingual support.",
    template: "researcher_cold",
    score_min: 70, score_max: 95,
  },
  university_admin: {
    keywords: ["dean", "director", "head of", "chair", "provost", "vice dean", "vice president research", "coordinator", "program director"],
    pain_points: "Managing stats support for multiple units is costly. Hiring full-time biostatisticians is slow. No standardized statistical validation across labs.",
    value_prop: "Naggar enterprise licensing: university-wide access with custom pricing, student ambassador program, dedicated account management.",
    template: "academic_partnership",
    score_min: 80, score_max: 100,
  },
  global_pharma: {
    keywords: ["biostatistician", "clinical trial", "pharma", "pharmaceutical", "cro", "biotech", "clinical research", "medical affairs", "regulatory", "bioinformatician"],
    pain_points: "In-house biostatistics team at full capacity. Delayed analysis slows pilot studies. Need FDA-compliant statistical reporting.",
    value_prop: "Naggar consulting overflow: high-end human-in-the-loop biostatistics meeting FDA/clinical trial standards.",
    template: "global_biomedical_researcher",
    score_min: 70, score_max: 95,
  },
  partnership_target: {
    keywords: ["co-founder", "ceo", "founder", "initiative", "capacity building", "workshop", "training", "consortium", "network", "alliance", "freelancer", "independent", "consultant"],
    pain_points: "Workshop participants need affordable biostatistics support. Building research capacity requires accessible tools.",
    value_prop: "Strategic partnership: integrate Naggar AI into training programs with custom discounted packages.",
    template: "biostruct_africa_partnership",
    score_min: 85, score_max: 100,
  },
  ambassador: {
    keywords: ["student", "master", "undergraduate", "graduate", "intern", "trainee", "research assistant", "bioinformatics intern", "data science intern"],
    pain_points: "Learning statistical analysis from scratch is time-consuming. Limited budget for professional services.",
    value_prop: "Naggar AI student ambassador program: free/discounted platform access with guided statistical logic.",
    template: "researcher_cold",
    score_min: 40, score_max: 70,
  },
};

function classifyTitle(title) {
  if (!title) return "academic_researcher";
  const lower = title.toLowerCase();
  let best = "academic_researcher";
  let bestLen = 0;
  for (const [type, rules] of Object.entries(PROFILE_RULES)) {
    for (const kw of rules.keywords) {
      if (lower.includes(kw) && kw.length > bestLen) {
        bestLen = kw.length;
        best = type;
      }
    }
  }
  return best;
}

function calcScore(type, title, company) {
  const rules = PROFILE_RULES[type] || PROFILE_RULES.academic_researcher;
  const mid = Math.floor((rules.score_min + rules.score_max) / 2);
  let score = mid;
  if (company && /university|institute|kaust|mayo|hopkins|harvard|oxford|cambridge|mit|stanford/i.test(company)) score += 10;
  if (title && /director|dean|head|vp|chief|president/i.test(title)) score += 5;
  return Math.min(score, rules.score_max);
}

function generateMessage(name, title, type, company) {
  const last = name.split(" ").pop() || "";
  const rules = PROFILE_RULES[type] || PROFILE_RULES.academic_researcher;
  const isDoctor = title && (title.includes("Dr.") || title.includes("Professor") || title.includes("PhD"));
  const salutation = isDoctor ? "Dr." : (title && /director|dean|chair/i.test(title) ? "Dr." : "Dr.");
  if (rules.template === "researcher_cold") {
    return `Dear ${salutation} ${last},

I came across your profile and was impressed by your work in research.

I'm reaching out from Naggar Analytics. We help researchers get their statistical analysis right — fast and affordably.

Our platform Naggar AI delivers:
- Complete statistical analysis in 15 minutes
- Human expert verification on every report
- Bilingual support (Arabic + English)
- Pricing from just $19 per analysis

Would you be open to a 10-minute call to see if this could help your research?

Best regards,
Dr. Noora Noureldin
Head of Public Relations, Naggar Analytics
nora@naggar.ai`;
  }
  if (rules.template === "global_biomedical_researcher") {
    return `Dear ${salutation} ${last},

I came across your publications on biomedical research and wanted to reach out.

I'm writing from Naggar Analytics — we provide rapid biostatistical consulting with senior human verification for journal and regulatory compliance.

We would be delighted to act as an overflow partner for your lab's analyses, helping accelerate your pipeline.

Best regards,
Dr. Alyaa Elrashedy
FMDV & Infectious Diseases Researcher
Naggar Analytics`;
  }
  if (rules.template === "academic_partnership") {
    return `Dear ${salutation} ${last},

I hope this message finds you well.

I'm reaching out from Naggar Analytics about a potential partnership. Our platform provides on-demand biostatistical analysis at a fraction of the cost of traditional CROs.

Would you be open to discussing how we could support your institution's researchers?

Best regards,
Dr. Noora Noureldin
Head of Public Relations, Naggar Analytics`;
  }
  return `Dear ${salutation} ${last},

I hope this message finds you well. I'm reaching out from Naggar Analytics, a research support platform.

Our platform helps researchers get publication-grade statistical analysis in minutes.

Would you be open to a brief chat?

Best regards,
Dr. Noora Noureldin
Naggar Analytics
nora@naggar.ai`;
}

// ─── Toast notification system ───
function injectToast() {
  if (document.getElementById("naggar-toast")) return;
  const el = document.createElement("div");
  el.id = "naggar-toast";
  el.style.cssText = "position:fixed;top:16px;right:16px;z-index:9999999;display:flex;flex-direction:column;gap:8px;pointer-events:none";
  document.body.appendChild(el);
}
function showToast(msg, type) {
  injectToast();
  const t = document.createElement("div");
  t.style.cssText = "padding:10px 16px;border-radius:8px;font-size:13px;font-family:-apple-system,sans-serif;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,0.15);animation:naggarFadeIn 0.3s ease;pointer-events:auto;max-width:320px;word-break:break-word;background:" + (type === "error" ? "#dc3545" : type === "info" ? "#0a66c2" : "#28a745") + ";color:#fff";
  t.textContent = msg;
  document.getElementById("naggar-toast").appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity 0.4s"; setTimeout(() => t.remove(), 400); }, 2800);
}
const styleSheet = document.createElement("style");
styleSheet.textContent = "@keyframes naggarFadeIn{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}";
document.head.appendChild(styleSheet);

// ─── Update badge count ───
async function updateBadge() {
  const leads = await getLeads();
  try { chrome.runtime.sendMessage({ action: "updateBadge", count: leads.length }); } catch(e) {}
}

// ─── Sanitize fields for CSV injection prevention ───
function sanitizeField(val) {
  if (!val) return "";
  let s = val.toString();
  // Strip HTML tags
  s = s.replace(/<[^>]*>/g, "");
  // CSV injection: if starts with =, +, -, @, @, prepend single quote
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s.trim();
}

function sanitizeLead(lead) {
  const out = {};
  for (const [k, v] of Object.entries(lead)) {
    if (typeof v === "string") out[k] = sanitizeField(v);
    else out[k] = v;
  }
  return out;
}

// ─── Build a complete lead object with all 22 columns ───
function makeLead(data) {
  const type = data.profile_type || classifyTitle(data.title || "");
  const score = data.score || calcScore(type, data.title, data.company_institution);
  return {
    date_discovered: data.date_discovered || new Date().toISOString().split("T")[0],
    source: data.source || "linkedin_extension",
    profile_url: data.profile_url || "",
    full_name: data.full_name || "",
    title: data.title || "",
    company_institution: data.company_institution || "",
    location: data.location || "",
    "email/Contact": data["email/Contact"] || "",
    linkedin_username: data.linkedin_username || (data.profile_url || "").match(/linkedin\.com\/in\/([^/?]+)/)?.[1] || "",
    profile_type: type,
    pain_points_identified: data.pain_points_identified || PROFILE_RULES[type]?.pain_points || "",
    value_proposition: data.value_proposition || PROFILE_RULES[type]?.value_prop || "",
    outreach_template_used: data.outreach_template_used || PROFILE_RULES[type]?.template || "researcher_cold",
    outreach_message: data.outreach_message || generateMessage(data.full_name || "", data.title || "", type, data.company_institution || ""),
    outreach_status: data.outreach_status || "pending",
    outreach_date: data.outreach_date || "",
    follow_up_date: data.follow_up_date || "",
    response: data.response || "",
    converted: data.converted || "",
    revenue_potential: data.revenue_potential || (type === "global_pharma" ? "High ($5K-50K)" : type === "university_admin" ? "Medium ($2K-20K)" : type === "partnership_target" ? "Medium ($1K-10K)" : type === "academic_researcher" ? "Low ($100-2K)" : "Low ($0-500)"),
    notes: data.notes || "",
    score: score,
  };
  return sanitizeLead(lead);
}

// ─── Extract profile from current page ───
function extractProfile() {
  try {
  const url = window.location.href.split("?")[0];
  if (!url.includes("/in/")) return null;

  // Try multiple selectors for name
  const nameSelectors = [
    "h1", "h2",
    "[class*='profile-name']",
    "[class*='inline-show-more-text']",
    "[class*='text-heading-xlarge']",
    "[class*='text-heading-large']",
  ];
  let name = "";
  for (const sel of nameSelectors) {
    const el = document.querySelector(sel);
    if (el && el.innerText.trim().length > 2) { name = el.innerText.trim(); break; }
  }
  // Fallback: find any visible large text that looks like a name (2+ capitalized words)
  if (!name) {
    for (const el of document.querySelectorAll("main span, main div")) {
      const t = el.innerText.trim();
      if (t.length > 4 && t.length < 60 && /^[A-Z][a-z]+ [A-Z]/.test(t) && !t.includes("\n")) {
        // Check parent for the typical profile card structure
        let p = el.parentElement;
        for (let i = 0; i < 4; i++) { if (p) p = p.parentElement; }
        if (p && (p.offsetWidth > 200 || p.classList.length > 3)) { name = t; break; }
      }
    }
  }

  // Title / headline
  const titleSelectors = [
    "[class*='text-body-medium']",
    "[class*='pv-top-card--headline']",
    "[class*='pv-text-details']",
    "[class*='text-heading-small']",
  ];
  let title = "";
  for (const sel of titleSelectors) {
    const el = document.querySelector(sel);
    if (el && el.innerText.trim().length > 3) { title = el.innerText.trim(); break; }
  }

  // Company from experience section or near top of profile
  let company = "";
  const expSec = document.querySelector("section:has(#experience)");
  if (expSec) {
    const items = expSec.querySelectorAll("li");
    for (const item of items) {
      const parts = item.innerText.trim().split("\n").filter(s => s.trim());
      if (parts.length > 1) { company = parts[1]; break; }
    }
  }
  if (!company) {
    // Try near the top card
    const topEls = document.querySelectorAll("[class*='top-card'] a, [class*='pv-top-card'] a");
    for (const el of topEls) {
      const t = el.innerText.trim();
      if (t && t.length > 2 && t.length < 80 && !t.includes("linkedin") && !t.includes("http")) { company = t; break; }
    }
  }

  // Location — look near top of page only
  let location = "";
  const locCandidates = document.querySelectorAll("[class*='pv-text-details'] span, [class*='top-card'] span, [class*='location'], [class*='text-body-small']");
  for (const el of locCandidates) {
    const t = el.innerText.trim();
    if (t && t.length > 3 && t.length < 80 && /[a-zA-Z]/.test(t) && (t.includes(",") || /(University|City|Region|Egypt|Riyadh|Dubai|Cairo|Jeddah|Doha)/i.test(t))) {
      location = t; break;
    }
  }

  const username = url.match(/linkedin\.com\/in\/([^/?]+)/)?.[1] || "";
  return makeLead({
    source: "linkedin_extension_profile",
    profile_url: url,
    full_name: name,
    title: title,
    company_institution: company,
    location: location,
    linkedin_username: username,
  });
  } catch (e) { console.debug("Naggar: extractProfile error", e); return null; }
}

// ─── Extract from search results ───
function extractSearchResults() {
  try {
  const leads = [];
  const seen = new Set();
  const links = document.querySelectorAll("a[href*='/in/']");

  links.forEach(link => {
    let href = link.href || link.getAttribute("href") || "";
    if (!href || href.includes("/search/") || href.includes("/mynetwork/")) return;
    href = href.split("?")[0];
    if (href.startsWith("/")) href = "https://www.linkedin.com" + href;
    if (seen.has(href)) return;
    seen.add(href);

    let card = link;
    for (let i = 0; i < 6; i++) { if (card.parentElement) card = card.parentElement; }
    const text = (card.innerText || "").trim();
    const lines = text.split("\n").map(l => l.trim()).filter(l => l);

    const linkText = (link.innerText || link.textContent || "").trim();
    if (!linkText || linkText.length < 2) return;

    const name = linkText;
    const title = lines.find(l => l !== name && l.length > 5 && l.length < 150) || "";
    // Try to extract company (second line after title or lines after)
    let company = "";
    const idx = lines.indexOf(title);
    for (let i = idx + 1; i < Math.min(idx + 4, lines.length); i++) {
      if (lines[i] !== name && lines[i] !== title && lines[i].length > 3 && !lines[i].includes("·") && !lines[i].startsWith("http")) {
        company = lines[i]; break;
      }
    }

    leads.push(makeLead({
      source: "linkedin_extension_search",
      profile_url: href,
      full_name: name,
      title: title,
      company_institution: company,
    }));
  });

  return leads;
  } catch (e) { console.debug("Naggar: extractSearchResults error", e); return []; }
}

// ─── Storage helpers ───
async function getLeads() {
  return new Promise(resolve => {
    chrome.storage.local.get([STORAGE_KEY], result => {
      resolve(result[STORAGE_KEY] || []);
    });
  });
}

async function saveLeads(newLeads) {
  const existing = await getLeads();
  const existingUrls = new Set(existing.map(l => l.profile_url));
  let added = 0;
  for (const lead of newLeads) {
    if (lead.profile_url && !existingUrls.has(lead.profile_url)) {
      existing.push(lead);
      existingUrls.add(lead.profile_url);
      added++;
    }
  }
  await new Promise(resolve => chrome.storage.local.set({ [STORAGE_KEY]: existing }, resolve));
  updateBadge();
  return { saved: added, total: existing.length };
}

// ─── Create a "Save Lead" button ───
function createSaveLeadBtn() {
  const btn = document.createElement("button");
  btn.id = "naggar-save-btn";
  btn.textContent = " Save Lead";
  let saving = false;
  btn.onclick = async () => {
    if (saving) return;
    saving = true;
    btn.textContent = "⏳";
    btn.style.opacity = "0.6";
    try {
      const data = extractProfile();
      if (!data || !data.full_name) { showToast("No profile data found — try scrolling or refreshing", "error"); saving = false; btn.textContent = " Save Lead"; btn.style.opacity = "1"; return; }
      const result = await saveLeads([data]);
      const info = [data.full_name, data.title, data.company_institution].filter(Boolean).join(" — ");
      showToast(`Saved: ${info}`, "success");
      btn.textContent = ` ${data.full_name} ✓`;
      setTimeout(() => { btn.textContent = " Save Lead"; }, 2000);
      btn.style.opacity = "1";
      saving = false;
    } catch (e) { showToast("Save failed", "error"); btn.textContent = " Save Lead"; btn.style.opacity = "1"; saving = false; }
  };
  return btn;
}

// ─── Try to place button on profile using multiple selector strategies ───
function placeProfileButton() {
  if (!window.location.href.includes("/in/")) return false;
  document.querySelectorAll("#naggar-save-btn").forEach(e => e.remove());

  const btn = createSaveLeadBtn();
  btn.style.position = "fixed";
  btn.style.bottom = "24px";
  btn.style.right = "24px";
  btn.style.zIndex = "999999";
  btn.style.borderRadius = "24px";
  btn.style.padding = "12px 24px";
  btn.style.fontSize = "14px";
  btn.style.boxShadow = "0 4px 12px rgba(0,0,0,0.25)";
  btn.style.transition = "all 0.2s";
  document.body.appendChild(btn);
  return true;
}

// ─── Create "Save All Visible" button (search results pages only) ───
function placeSearchButton() {
  const isSearch = window.location.href.includes("/search/results/");
  if (!isSearch) return;
  // Also check we're NOT on a profile page
  if (window.location.href.includes("/in/")) return;
  document.querySelectorAll("#naggar-search-btn").forEach(e => e.remove());
  const btn = document.createElement("button");
  btn.id = "naggar-search-btn";
  btn.textContent = " Save All Visible";
  btn.style.position = "fixed";
  btn.style.bottom = "24px";
  btn.style.right = "24px";
  btn.style.zIndex = "999999";
  btn.style.borderRadius = "24px";
  btn.style.padding = "12px 24px";
  btn.style.fontSize = "14px";
  btn.style.boxShadow = "0 4px 12px rgba(0,0,0,0.25)";
  let saving = false;
  btn.onclick = async () => {
    if (saving) return;
    saving = true;
    btn.textContent = " Scanning...";
    btn.style.opacity = "0.6";
    try {
      const leads = extractSearchResults();
      if (leads.length === 0) { showToast("No profiles found on this page", "info"); saving = false; btn.textContent = " Save All Visible"; btn.style.opacity = "1"; return; }
      btn.textContent = ` Saving ${leads.length}...`;
      const result = await saveLeads(leads);
      showToast(`Saved ${result.saved} leads (${result.total} total)`, "success");
      btn.textContent = ` ${result.total} Total`;
      setTimeout(() => { btn.textContent = " Save All Visible"; }, 2000);
      btn.textContent = " Save All Visible";
      btn.style.opacity = "1";
      saving = false;
    } catch (e) { showToast("Batch save failed", "error"); btn.textContent = " Save All Visible"; btn.style.opacity = "1"; saving = false; }
  };
  document.body.appendChild(btn);
}

// ─── Inject buttons ───
function injectButtons() {
  const isProfile = window.location.href.includes("/in/");
  const isSearch = window.location.href.includes("/search/results/");

  // Profile page → Save Lead button
  if (isProfile) {
    if (!placeProfileButton()) {
      let attempts = 0;
      const retry = setInterval(() => { attempts++; if (placeProfileButton() || attempts >= 10) clearInterval(retry); }, 1000);
    }
  }

  // Search results page → Save All Visible button
  if (isSearch) {
    placeSearchButton();
    let attempts = 0;
    const retry = setInterval(() => { attempts++; if (attempts >= 8) clearInterval(retry);
      const btn = document.getElementById("naggar-search-btn");
      if (!btn) placeSearchButton(); else clearInterval(retry);
    }, 1500);
  }
}

// ─── Run ───
setTimeout(() => { injectButtons(); updateBadge(); }, 1500);

// Handle LinkedIn SPA navigation (profile opens without full page load)
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    setTimeout(injectButtons, 1200);
  }
});
observer.observe(document, { subtree: true, childList: true });

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getLeads") {
    getLeads().then(leads => sendResponse({ leads }));
    return true;
  }
  if (request.action === "clearLeads") {
    chrome.storage.local.set({ [STORAGE_KEY]: [] }, () => sendResponse({ cleared: true }));
    return true;
  }
  if (request.action === "extractCurrent") {
    const data = extractProfile();
    sendResponse({ lead: data });
    return true;
  }
  if (request.action === "getQueries") {
    sendResponse({ queries: SEARCH_QUERIES });
    return true;
  }
});
