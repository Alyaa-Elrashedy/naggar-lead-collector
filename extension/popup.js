const STORAGE_KEY = "naggar_leads";
const CUSTOM_QUERIES_KEY = "naggar_custom_queries";

function $(id) { return document.getElementById(id); }

function status(el, msg, isError) {
  el.textContent = msg;
  el.style.color = isError ? "#dc3545" : "#666";
}

async function getLeads() {
  return new Promise(resolve => {
    chrome.storage.local.get([STORAGE_KEY], result => resolve(result[STORAGE_KEY] || []));
  });
}

async function setLeads(leads) {
  await new Promise(resolve => chrome.storage.local.set({ [STORAGE_KEY]: leads }, resolve));
  try { chrome.runtime.sendMessage({ action: "updateBadge", count: leads.length }); } catch(e) {}
}

async function getCustomQueries() {
  return new Promise(resolve => {
    chrome.storage.local.get([CUSTOM_QUERIES_KEY], result => resolve(result[CUSTOM_QUERIES_KEY] || []));
  });
}

async function setCustomQueries(qs) {
  await new Promise(resolve => chrome.storage.local.set({ [CUSTOM_QUERIES_KEY]: qs }, resolve));
}

const TYPE_COLORS = {
  academic_researcher: "badge-researcher",
  university_admin: "badge-admin",
  global_pharma: "badge-pharma",
  partnership_target: "badge-partner",
  ambassador: "badge-ambassador",
};
const TYPE_LABELS = {
  academic_researcher: "Academic",
  university_admin: "Admin",
  global_pharma: "Pharma",
  partnership_target: "Partner",
  ambassador: "Ambassador",
};
const TYPE_PILL_COLORS = {
  academic_researcher: "background:#e3f2fd;color:#1565c0",
  university_admin: "background:#f3e5f5;color:#7b1fa2",
  global_pharma: "background:#e8f5e9;color:#2e7d32",
  partnership_target: "background:#fff3e0;color:#e65100",
  ambassador: "background:#fce4ec;color:#c62828",
};

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function downloadCSV(leads) {
  if (leads.length === 0) { status($("statusLeads"), "No leads to export"); return; }
  const headers = [
    "date_discovered","source","profile_url","full_name","title","company_institution",
    "location","email/Contact","linkedin_username","profile_type","pain_points_identified",
    "value_proposition","outreach_template_used","outreach_message","outreach_status",
    "outreach_date","follow_up_date","response","converted","revenue_potential","notes","score"
  ];
  const rows = leads.map(l => headers.map(h => {
    let val = (l[h] || l[h.toLowerCase()] || "").toString();
    val = val.replace(/<[^>]*>/g, "");
    if (/^[=+\-@]/.test(val)) val = "'" + val;
    val = val.replace(/"/g, '""');
    if (val.includes(",") || val.includes("\n") || val.includes('"')) val = `"${val}"`;
    return val;
  }).join(","));
  const csv = "\ufeff" + headers.join(",") + "\n" + rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `naggar_leads_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  status($("statusLeads"), `Downloaded ${leads.length} leads`);
}

// ─── Render leads tab ───
async function renderLeads() {
  const leads = await getLeads();
  $("leadCount").textContent = leads.length;
  try { chrome.runtime.sendMessage({ action: "updateBadge", count: leads.length }); } catch(e) {}

  // Type breakdown
  const counts = {};
  for (const l of leads) {
    const t = l.profile_type || "unknown";
    counts[t] = (counts[t] || 0) + 1;
  }
  $("typeBreakdown").innerHTML = Object.entries(counts).map(([type, count]) =>
    `<span class="type-pill" style="${TYPE_PILL_COLORS[type] || ""}">${TYPE_LABELS[type] || type}: ${count}</span>`
  ).join("");

  // Full lead list with delete
  if (leads.length === 0) {
    $("leadList").innerHTML = '<div class="empty-state">No leads yet. Go to LinkedIn and click "Save Lead"</div>';
    $("leadSubCount").textContent = "";
  } else {
    $("leadSubCount").textContent = `(${leads.length} total)`;
    $("leadList").innerHTML = leads.map((l, i) => {
      const typeClass = TYPE_COLORS[l.profile_type] || "";
      const typeLabel = TYPE_LABELS[l.profile_type] || l.profile_type || "";
      return `<div class="list-item">
        <div class="item-main">
          <div class="item-name">${escapeHtml(l.full_name || "Unknown")}</div>
          <div class="item-title">${escapeHtml(l.title || "")}</div>
          <div class="item-meta">
            <span class="badge ${typeClass}">${typeLabel}</span>
            <span>Score: ${l.score || "—"}</span>
            <span>${escapeHtml(l.company_institution || "")}</span>
          </div>
        </div>
        <button class="btn-danger-sm" data-idx="${i}">Delete</button>
      </div>`;
    }).join("");

    // Delete handlers
    $("leadList").querySelectorAll(".btn-danger-sm").forEach(btn => {
      btn.addEventListener("click", async () => {
        const idx = parseInt(btn.dataset.idx);
        const curr = await getLeads();
        const name = curr[idx]?.full_name || "this lead";
        if (!confirm(`Delete ${name}?`)) return;
        curr.splice(idx, 1);
        await setLeads(curr);
        renderLeads();
        status($("statusLeads"), `Deleted: ${name}`);
      });
    });
  }
}

// ─── Tab switching ───
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    $(`panel-${tab.dataset.tab}`).classList.add("active");
    if (tab.dataset.tab === "leads") renderLeads();
    if (tab.dataset.tab === "discover") renderQueries();
    if (tab.dataset.tab === "settings") renderCustomQueries();
  });
});

// ─── Built-in queries ───
const BUILT_IN_QUERIES = [
  {label:"Professors - Biostatistics",url:"https://www.linkedin.com/search/results/people/?keywords=biostatistics%20professor"},
  {label:"Professors - Epidemiology",url:"https://www.linkedin.com/search/results/people/?keywords=epidemiology%20professor"},
  {label:"Professors - Public Health",url:"https://www.linkedin.com/search/results/people/?keywords=public%20health%20professor"},
  {label:"PhD Candidates - Biostatistics",url:"https://www.linkedin.com/search/results/people/?keywords=biostatistics%20PhD%20candidate"},
  {label:"PhD Candidates - Epidemiology",url:"https://www.linkedin.com/search/results/people/?keywords=epidemiology%20PhD%20candidate"},
  {label:"Postdoctoral Researchers",url:"https://www.linkedin.com/search/results/people/?keywords=postdoctoral%20researcher%20biostatistics"},
  {label:"Research Scientists - Bioinformatics",url:"https://www.linkedin.com/search/results/people/?keywords=bioinformatics%20research%20scientist"},
  {label:"Research Scientists - Data Science",url:"https://www.linkedin.com/search/results/people/?keywords=data%20science%20research%20scientist"},
  {label:"Medical Researchers",url:"https://www.linkedin.com/search/results/people/?keywords=medical%20researcher"},
  {label:"Clinical Researchers",url:"https://www.linkedin.com/search/results/people/?keywords=clinical%20researcher"},
  {label:"Deans - Research",url:"https://www.linkedin.com/search/results/people/?keywords=dean%20of%20research"},
  {label:"Vice Deans - Graduate Studies",url:"https://www.linkedin.com/search/results/people/?keywords=vice%20dean%20graduate%20studies"},
  {label:"Research Center Directors",url:"https://www.linkedin.com/search/results/people/?keywords=research%20center%20director"},
  {label:"Vice Presidents - Research",url:"https://www.linkedin.com/search/results/people/?keywords=vice%20president%20research%20university"},
  {label:"Lab Directors",url:"https://www.linkedin.com/search/results/people/?keywords=lab%20director%20university"},
  {label:"Department Chairs",url:"https://www.linkedin.com/search/results/people/?keywords=department%20chair%20biostatistics"},
  {label:"Program Coordinators - Research",url:"https://www.linkedin.com/search/results/people/?keywords=research%20program%20coordinator"},
  {label:"Research Development Officers",url:"https://www.linkedin.com/search/results/people/?keywords=research%20development%20officer"},
  {label:"Biostatisticians - Pharma",url:"https://www.linkedin.com/search/results/people/?keywords=biostatistician%20pharmaceutical"},
  {label:"Clinical Trial Managers",url:"https://www.linkedin.com/search/results/people/?keywords=clinical%20trial%20manager"},
  {label:"Clinical Research Associates",url:"https://www.linkedin.com/search/results/people/?keywords=clinical%20research%20associate"},
  {label:"Medical Affairs Directors",url:"https://www.linkedin.com/search/results/people/?keywords=medical%20affairs%20director"},
  {label:"Regulatory Affairs - Biostatistics",url:"https://www.linkedin.com/search/results/people/?keywords=regulatory%20affairs%20biostatistics"},
  {label:"CRO - Business Development",url:"https://www.linkedin.com/search/results/people/?keywords=CRO%20business%20development"},
  {label:"Pharma R&D Managers",url:"https://www.linkedin.com/search/results/people/?keywords=pharma%20R%26D%20manager"},
  {label:"Biotech Founders",url:"https://www.linkedin.com/search/results/people/?keywords=biotech%20founder"},
  {label:"Biostatistics Directors",url:"https://www.linkedin.com/search/results/people/?keywords=director%20biostatistics"},
  {label:"Data Management - Clinical",url:"https://www.linkedin.com/search/results/people/?keywords=clinical%20data%20management"},
  {label:"Co-Founders - HealthTech",url:"https://www.linkedin.com/search/results/people/?keywords=healthtech%20co-founder"},
  {label:"CEOs - Research Services",url:"https://www.linkedin.com/search/results/people/?keywords=CEO%20research%20services"},
  {label:"Founders - EdTech",url:"https://www.linkedin.com/search/results/people/?keywords=edtech%20founder"},
  {label:"Capacity Building - Research",url:"https://www.linkedin.com/search/results/people/?keywords=research%20capacity%20building"},
  {label:"Training Directors - Research",url:"https://www.linkedin.com/search/results/people/?keywords=research%20training%20director"},
  {label:"Consortium Leaders",url:"https://www.linkedin.com/search/results/people/?keywords=research%20consortium%20leader"},
  {label:"Workshop Organizers - Research",url:"https://www.linkedin.com/search/results/people/?keywords=research%20workshop%20organizer"},
  {label:"Innovation Center Directors",url:"https://www.linkedin.com/search/results/people/?keywords=innovation%20center%20director"},
  {label:"Science Park Managers",url:"https://www.linkedin.com/search/results/people/?keywords=science%20park%20manager"},
  {label:"Saudi Arabia - Professors",url:"https://www.linkedin.com/search/results/people/?keywords=professor&geoUrn=101282733"},
  {label:"Saudi Arabia - Researchers",url:"https://www.linkedin.com/search/results/people/?keywords=researcher&geoUrn=101282733"},
  {label:"Saudi Arabia - PhD",url:"https://www.linkedin.com/search/results/people/?keywords=PhD%20candidate&geoUrn=101282733"},
  {label:"KAUST - Researchers",url:"https://www.linkedin.com/search/results/people/?keywords=KAUST%20researcher"},
  {label:"UAE - Professors",url:"https://www.linkedin.com/search/results/people/?keywords=professor&geoUrn=101194590"},
  {label:"UAE - Researchers",url:"https://www.linkedin.com/search/results/people/?keywords=researcher&geoUrn=101194590"},
  {label:"UAE - PhD",url:"https://www.linkedin.com/search/results/people/?keywords=PhD%20candidate&geoUrn=101194590"},
  {label:"Egypt - Professors",url:"https://www.linkedin.com/search/results/people/?keywords=professor&geoUrn=102100715"},
  {label:"Egypt - Researchers",url:"https://www.linkedin.com/search/results/people/?keywords=researcher&geoUrn=102100715"},
  {label:"Egypt - PhD",url:"https://www.linkedin.com/search/results/people/?keywords=PhD%20candidate&geoUrn=102100715"},
  {label:"USA - Biostatistics Professors",url:"https://www.linkedin.com/search/results/people/?keywords=biostatistics%20professor&geoUrn=103644278"},
  {label:"USA - Epidemiology Researchers",url:"https://www.linkedin.com/search/results/people/?keywords=epidemiology%20researcher&geoUrn=103644278"},
  {label:"USA - Public Health Researchers",url:"https://www.linkedin.com/search/results/people/?keywords=public%20health%20researcher&geoUrn=103644278"},
  {label:"UK - Biostatistics Researchers",url:"https://www.linkedin.com/search/results/people/?keywords=biostatistics%20researcher&geoUrn=101165590"},
  {label:"UK - Epidemiology Researchers",url:"https://www.linkedin.com/search/results/people/?keywords=epidemiology%20researcher&geoUrn=101165590"},
  {label:"UK - Public Health",url:"https://www.linkedin.com/search/results/people/?keywords=public%20health%20researcher&geoUrn=101165590"},
  {label:"Germany - Researchers",url:"https://www.linkedin.com/search/results/people/?keywords=researcher&geoUrn=101282230"},
  {label:"Germany - Biostatistics",url:"https://www.linkedin.com/search/results/people/?keywords=biostatistics&geoUrn=101282230"},
  {label:"Graduate Students - Biostatistics",url:"https://www.linkedin.com/search/results/people/?keywords=master%20student%20biostatistics"},
  {label:"Research Assistants",url:"https://www.linkedin.com/search/results/people/?keywords=research%20assistant%20biostatistics"},
  {label:"Teaching Assistants - Statistics",url:"https://www.linkedin.com/search/results/people/?keywords=teaching%20assistant%20statistics"},
];

async function renderQueries() {
  const custom = await getCustomQueries();
  const all = [...BUILT_IN_QUERIES, ...custom.map((q, i) => ({ ...q, isCustom: true, idx: i }))];
  $("queryList").innerHTML = all.length === 0
    ? '<div class="empty-state">No queries</div>'
    : all.map((q, i) => {
        const isProfile = q.url && q.url.includes("/in/");
        return `<div class="list-item">
          <div class="item-main">
            <div class="item-name">${escapeHtml(q.label)}</div>
            <div class="item-title" style="font-size:9px;color:#aaa">${q.isCustom ? (isProfile ? "Profile" : "Custom") : "Built-in"}</div>
          </div>
          <button class="q-open" data-idx="${i}" data-url="${escapeHtml(q.url)}" style="font-size:10px;color:#0a66c2;background:#e8f0fe;padding:2px 10px;border-radius:10px;cursor:pointer;border:none;font-weight:600">Open</button>
        </div>`;
      }).join("");

  $("queryList").querySelectorAll(".q-open").forEach(btn => {
    btn.addEventListener("click", () => {
      chrome.tabs.create({ url: btn.dataset.url });
      btn.textContent = "Opened";
      btn.style.opacity = "0.5";
      status($("statusDiscover"), `Opened query`);
    });
  });

  $("openAllBtn").onclick = () => {
    all.forEach(q => chrome.tabs.create({ url: q.url }));
    status($("statusDiscover"), `Opened ${all.length} tabs`);
  };
  $("hideOpenedBtn").onclick = () => {
    let h = 0;
    $("queryList").querySelectorAll(".q-open").forEach(b => { if (b.textContent === "Opened" || b.style.opacity === "0.5") { b.closest(".list-item").style.display = "none"; h++; } });
    status($("statusDiscover"), `Hidden ${h}`);
  };
}

// ─── Custom queries (Settings) ───
async function renderCustomQueries() {
  const custom = await getCustomQueries();
  if (custom.length === 0) {
    $("customQueriesList").innerHTML = '<span style="font-size:11px;color:#999">No custom queries yet</span>';
  } else {
    $("customQueriesList").innerHTML = custom.map((q, i) =>
      `<span class="query-pill">${escapeHtml(q.label)} <span class="remove" data-cq="${i}">x</span></span>`
    ).join("");
    $("customQueriesList").querySelectorAll(".remove").forEach(el => {
      el.addEventListener("click", async () => {
        const idx = parseInt(el.dataset.cq);
        const curr = await getCustomQueries();
        curr.splice(idx, 1);
        await setCustomQueries(curr);
        renderCustomQueries();
        renderQueries();
        status($("statusSettings"), "Query removed");
      });
    });
  }
}

// ─── Init ───
document.addEventListener("DOMContentLoaded", async () => {
  await renderLeads();

  // Download
  $("downloadBtn").addEventListener("click", () => getLeads().then(downloadCSV));
  $("downloadBtn2").addEventListener("click", () => getLeads().then(downloadCSV));

  // Clear
  async function clearAll() {
    const curr = await getLeads();
    if (curr.length === 0) { status($("statusLeads"), "No leads to clear"); return; }
    if (!confirm(`Delete all ${curr.length} leads?`)) return;
    await setLeads([]);
    renderLeads();
    status($("statusLeads"), "All leads cleared");
  }
  $("clearBtn").addEventListener("click", clearAll);
  $("clearBtn2").addEventListener("click", clearAll);

  // Save current profile
  $("currentBtn").addEventListener("click", async () => {
    const tabs = await new Promise(resolve => chrome.tabs.query({ active: true, currentWindow: true }, resolve));
    if (!tabs[0] || !tabs[0].url?.includes("linkedin.com")) {
      status($("statusLeads"), "Not on a LinkedIn page", true);
      return;
    }
    chrome.tabs.sendMessage(tabs[0].id, { action: "extractCurrent" }, async response => {
      if (!response || !response.lead || !response.lead.full_name) {
        status($("statusLeads"), "Go to a LinkedIn profile", true);
        return;
      }
      const lead = response.lead;
      const curr = await getLeads();
      if (curr.some(l => l.profile_url === lead.profile_url)) {
        status($("statusLeads"), "Already saved");
        return;
      }
      curr.push(lead);
      await setLeads(curr);
      renderLeads();
      status($("statusLeads"), `Saved: ${lead.full_name}`);
    });
  });

  // Auto Discover tab
  await renderQueries();

  // Add profile URL → save as lead
  $("addProfileBtn").addEventListener("click", async () => {
    const input = $("profileUrlInput");
    const url = input.value.trim();
    if (!url) { $("profileUrlStatus").textContent = "Paste a URL first"; $("profileUrlStatus").style.color = "#dc3545"; return; }
    if (!url.includes("linkedin.com/in/")) {
      $("profileUrlStatus").textContent = "Must be a LinkedIn profile URL (linkedin.com/in/...)";
      $("profileUrlStatus").style.color = "#dc3545";
      return;
    }
    const cleanUrl = url.split("?")[0];
    const uname = cleanUrl.match(/linkedin\.com\/in\/([^/?]+)/);
    const name = uname ? decodeURIComponent(uname[1]).replace(/[-]/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "Unknown";

    const curr = await getLeads();
    if (curr.some(l => l.profile_url === cleanUrl)) {
      $("profileUrlStatus").textContent = "This profile is already saved";
      $("profileUrlStatus").style.color = "#dc3545";
      return;
    }

    curr.push({
      date_discovered: new Date().toISOString().split("T")[0],
      source: "manual_url",
      profile_url: cleanUrl,
      full_name: name,
      title: "",
      company_institution: "",
      location: "",
      "email/Contact": "",
      linkedin_username: uname ? uname[1] : "",
      profile_type: "academic_researcher",
      pain_points_identified: "",
      value_proposition: "",
      outreach_template_used: "researcher_cold",
      outreach_message: "",
      outreach_status: "pending",
      outreach_date: "",
      follow_up_date: "",
      response: "",
      converted: "",
      revenue_potential: "",
      notes: "Added via URL — visit profile to auto-fill",
      score: 50,
    });
    await setLeads(curr);
    input.value = "";
    $("profileUrlStatus").textContent = `Saved: ${name}`;
    $("profileUrlStatus").style.color = "#28a745";
    renderLeads();
  });

  // Add search query → save as custom query
  $("addQueryBtn").addEventListener("click", async () => {
    const input = $("customQueryInput");
    const url = input.value.trim();
    if (!url) { status($("statusSettings"), "Paste a LinkedIn URL first", true); return; }
    if (!url.includes("linkedin.com")) {
      status($("statusSettings"), "Must be a LinkedIn URL", true);
      return;
    }
    let label = "Custom";
    const isProfile = url.includes("/in/");
    if (isProfile) {
      const uname = url.match(/linkedin\.com\/in\/([^/?]+)/);
      label = uname ? `Profile: ${decodeURIComponent(uname[1])}` : "LinkedIn Profile";
    } else {
      const m = url.match(/keywords=([^&]+)/);
      if (m) label = decodeURIComponent(m[1]).replace(/\+/g, " ").replace(/%20/g, " ").substring(0, 40);
      const geo = url.match(/geoUrn=(\d+)/);
      const locNames = { "101282733": "Saudi", "101194590": "UAE", "102100715": "Egypt", "103644278": "USA", "101165590": "UK", "101282230": "Germany" };
      if (geo && locNames[geo[1]]) label += ` (${locNames[geo[1]]})`;
    }

    const curr = await getCustomQueries();
    if (curr.some(q => q.url === url)) { status($("statusSettings"), "Already exists"); return; }
    curr.push({ label, url });
    await setCustomQueries(curr);
    input.value = "";
    renderCustomQueries();
    renderQueries();
    status($("statusSettings"), `Added: ${label}`);
  });

  $("profileUrlInput").addEventListener("keydown", e => { if (e.key === "Enter") $("addProfileBtn").click(); });
  $("customQueryInput").addEventListener("keydown", e => { if (e.key === "Enter") $("addQueryBtn").click(); });

  // Settings - Import/Export
  $("exportJsonBtn").addEventListener("click", async () => {
    const all = await getLeads();
    if (all.length === 0) { status($("statusSettings"), "No leads to export"); return; }
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `naggar_backup_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    status($("statusSettings"), `Exported ${all.length} leads`);
  });

  $("importJsonBtn").addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const imported = JSON.parse(text);
        if (!Array.isArray(imported)) throw new Error("Invalid");
        const curr = await getLeads();
        const existingUrls = new Set(curr.map(l => l.profile_url));
        let added = 0;
        for (const lead of imported) {
          if (lead.profile_url && !existingUrls.has(lead.profile_url)) {
            curr.push(lead);
            existingUrls.add(lead.profile_url);
            added++;
          }
        }
        await setLeads(curr);
        renderLeads();
        status($("statusSettings"), `Imported ${added} new leads`);
      } catch { status($("statusSettings"), "Import failed", true); }
    };
    input.click();
  });
});
