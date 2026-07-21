const STORAGE_KEY = "naggar_leads";

function $(id) { return document.getElementById(id); }

function status(el, msg, isError = false) {
  el.textContent = msg;
  el.style.color = isError ? "#dc3545" : "#666";
}

async function getLeads() {
  return new Promise(resolve => {
    chrome.storage.local.get([STORAGE_KEY], result => {
      resolve(result[STORAGE_KEY] || []);
    });
  });
}

const TYPE_COLORS = {
  academic_researcher: "badge-researcher",
  university_admin: "badge-admin",
  global_pharma: "badge-pharma",
  partnership_target: "badge-partner",
  ambassador: "badge-ambassador",
};
const TYPE_LABELS = {
  academic_researcher: "Researcher",
  university_admin: "Admin",
  global_pharma: "Pharma",
  partnership_target: "Partner",
  ambassador: "Ambassador",
};

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

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function renderLeads(leads) {
  $("leadCount").textContent = leads.length;
  // Update badge
  try { chrome.runtime.sendMessage({ action: "updateBadge", count: leads.length }); } catch(e) {}

  // Type breakdown
  const counts = {};
  for (const l of leads) {
    const t = l.profile_type || "unknown";
    counts[t] = (counts[t] || 0) + 1;
  }
  $("typeBreakdown").innerHTML = Object.entries(counts).map(([type, count]) =>
    `<span class="type-pill ${TYPE_COLORS[type] || ""}">${TYPE_LABELS[type] || type}: ${count}</span>`
  ).join("");

  // Recent leads (last 5, newest first)
  const recent = leads.slice(-5).reverse();
  if (recent.length === 0) {
    $("recentList").innerHTML = '<div class="empty-state">No leads yet. Go to LinkedIn and click "Save Lead"</div>';
  } else {
    $("recentList").innerHTML = recent.map(l => {
      const typeClass = TYPE_COLORS[l.profile_type] || "";
      const typeLabel = TYPE_LABELS[l.profile_type] || l.profile_type || "";
      return `<div class="recent-item">
        <div class="recent-name">${escapeHtml(l.full_name || "Unknown")}</div>
        <div class="recent-title">${escapeHtml(l.title || "")}</div>
        <div class="recent-meta">
          <span class="badge ${typeClass}">${typeLabel}</span>
          <span>Score: ${l.score || "—"}</span>
          <span>${escapeHtml(l.company_institution || "")}</span>
        </div>
      </div>`;
    }).join("");
  }
}

// ─── Tab switching ───
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    $(`panel-${tab.dataset.tab}`).classList.add("active");
    if (tab.dataset.tab === "leads") getLeads().then(renderLeads);
  });
});

// ─── Init ───
document.addEventListener("DOMContentLoaded", async () => {
  const leads = await getLeads();
  renderLeads(leads);

  // Download
  $("downloadBtn").addEventListener("click", () => getLeads().then(downloadCSV));
  $("downloadBtn2").addEventListener("click", () => getLeads().then(downloadCSV));

  // Clear
  async function clearAll() {
    const curr = await getLeads();
    if (curr.length === 0) { status($("statusLeads"), "No leads to clear"); return; }
    if (!confirm(`Delete all ${curr.length} leads?`)) return;
    await new Promise(resolve => chrome.storage.local.set({ [STORAGE_KEY]: [] }, resolve));
    try { chrome.runtime.sendMessage({ action: "updateBadge", count: 0 }); } catch(e) {}
    renderLeads([]);
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
        status($("statusLeads"), "Go to a LinkedIn profile page first", true);
        return;
      }
      const lead = response.lead;
      const curr = await getLeads();
      if (curr.some(l => l.profile_url === lead.profile_url)) {
        status($("statusLeads"), "Already saved");
        return;
      }
      curr.push(lead);
      await new Promise(resolve => chrome.storage.local.set({ [STORAGE_KEY]: curr }, resolve));
      renderLeads(curr);
      status($("statusLeads"), `Saved: ${lead.full_name}`);
    });
  });

  // ─── AUTO DISCOVER ───
  const queries = [
    {label:"Professors - Biostatistics",url:"https://www.linkedin.com/search/results/people/?keywords=biostatistics%20professor"},
    {label:"Professors - Epidemiology",url:"https://www.linkedin.com/search/results/people/?keywords=epidemiology%20professor"},
    {label:"Professors - Public Health",url:"https://www.linkedin.com/search/results/people/?keywords=public%20health%20professor"},
    {label:"PhD Candidates - Biostatistics",url:"https://www.linkedin.com/search/results/people/?keywords=biostatistics%20PhD%20candidate"},
    {label:"PhD Candidates - Epidemiology",url:"https://www.linkedin.com/search/results/people/?keywords=epidemiology%20PhD%20candidate"},
    {label:"Postdoctoral Researchers",url:"https://www.linkedin.com/search/results/people/?keywords=postdoctoral%20researcher%20biostatistics"},
    {label:"Research Scientists - Bioinformatics",url:"https://www.linkedin.com/search/results/people/?keywords=bioinformatics%20research%20scientist"},
    {label:"Medical Researchers",url:"https://www.linkedin.com/search/results/people/?keywords=medical%20researcher"},
    {label:"Clinical Researchers",url:"https://www.linkedin.com/search/results/people/?keywords=clinical%20researcher"},
    {label:"Deans - Research",url:"https://www.linkedin.com/search/results/people/?keywords=dean%20of%20research"},
    {label:"Research Center Directors",url:"https://www.linkedin.com/search/results/people/?keywords=research%20center%20director"},
    {label:"VPs - Research",url:"https://www.linkedin.com/search/results/people/?keywords=vice%20president%20research%20university"},
    {label:"Lab Directors",url:"https://www.linkedin.com/search/results/people/?keywords=lab%20director%20university"},
    {label:"Department Chairs",url:"https://www.linkedin.com/search/results/people/?keywords=department%20chair%20biostatistics"},
    {label:"Biostatisticians - Pharma",url:"https://www.linkedin.com/search/results/people/?keywords=biostatistician%20pharmaceutical"},
    {label:"Clinical Trial Managers",url:"https://www.linkedin.com/search/results/people/?keywords=clinical%20trial%20manager"},
    {label:"Clinical Research Associates",url:"https://www.linkedin.com/search/results/people/?keywords=clinical%20research%20associate"},
    {label:"Medical Affairs Directors",url:"https://www.linkedin.com/search/results/people/?keywords=medical%20affairs%20director"},
    {label:"CRO - Business Development",url:"https://www.linkedin.com/search/results/people/?keywords=CRO%20business%20development"},
    {label:"Pharma R&D Managers",url:"https://www.linkedin.com/search/results/people/?keywords=pharma%20R%26D%20manager"},
    {label:"Biotech Founders",url:"https://www.linkedin.com/search/results/people/?keywords=biotech%20founder"},
    {label:"Biostatistics Directors",url:"https://www.linkedin.com/search/results/people/?keywords=director%20biostatistics"},
    {label:"Co-Founders - HealthTech",url:"https://www.linkedin.com/search/results/people/?keywords=healthtech%20co-founder"},
    {label:"CEOs - Research Services",url:"https://www.linkedin.com/search/results/people/?keywords=CEO%20research%20services"},
    {label:"Capacity Building - Research",url:"https://www.linkedin.com/search/results/people/?keywords=research%20capacity%20building"},
    {label:"Consortium Leaders",url:"https://www.linkedin.com/search/results/people/?keywords=research%20consortium%20leader"},
    {label:"Saudi - Professors",url:"https://www.linkedin.com/search/results/people/?keywords=professor&geoUrn=101282733"},
    {label:"Saudi - Researchers",url:"https://www.linkedin.com/search/results/people/?keywords=researcher&geoUrn=101282733"},
    {label:"Saudi - PhD Candidates",url:"https://www.linkedin.com/search/results/people/?keywords=PhD%20candidate&geoUrn=101282733"},
    {label:"KAUST - Researchers",url:"https://www.linkedin.com/search/results/people/?keywords=KAUST%20researcher"},
    {label:"UAE - Professors",url:"https://www.linkedin.com/search/results/people/?keywords=professor&geoUrn=101194590"},
    {label:"UAE - Researchers",url:"https://www.linkedin.com/search/results/people/?keywords=researcher&geoUrn=101194590"},
    {label:"Egypt - Professors",url:"https://www.linkedin.com/search/results/people/?keywords=professor&geoUrn=102100715"},
    {label:"Egypt - Researchers",url:"https://www.linkedin.com/search/results/people/?keywords=researcher&geoUrn=102100715"},
    {label:"USA - Biostatistics",url:"https://www.linkedin.com/search/results/people/?keywords=biostatistics%20professor&geoUrn=103644278"},
    {label:"USA - Epidemiology",url:"https://www.linkedin.com/search/results/people/?keywords=epidemiology%20researcher&geoUrn=103644278"},
    {label:"UK - Biostatistics",url:"https://www.linkedin.com/search/results/people/?keywords=biostatistics%20researcher&geoUrn=101165590"},
    {label:"UK - Epidemiology",url:"https://www.linkedin.com/search/results/people/?keywords=epidemiology%20researcher&geoUrn=101165590"},
    {label:"Germany - Researchers",url:"https://www.linkedin.com/search/results/people/?keywords=researcher&geoUrn=101282230"},
    {label:"Graduate Students",url:"https://www.linkedin.com/search/results/people/?keywords=master%20student%20biostatistics"},
    {label:"Research Assistants",url:"https://www.linkedin.com/search/results/people/?keywords=research%20assistant%20biostatistics"},
  ];

  function renderQueries(list) {
    $("queryList").innerHTML = list.map((q, i) =>
      `<div class="query-item" data-idx="${i}">
        <span class="q-label">${q.label}</span>
        <span class="q-open">Open</span>
      </div>`
    ).join("");
    $("queryList").querySelectorAll(".query-item").forEach(el => {
      const idx = parseInt(el.dataset.idx);
      el.querySelector(".q-open").addEventListener("click", (e) => {
        e.stopPropagation();
        chrome.tabs.create({ url: queries[idx].url });
        el.style.opacity = "0.4";
        status($("statusDiscover"), `Opened: ${queries[idx].label}`);
      });
    });
  }

  renderQueries(queries);
  status($("statusDiscover"), `${queries.length} search queries ready`);

  $("openAllBtn").addEventListener("click", () => {
    queries.forEach(q => chrome.tabs.create({ url: q.url }));
    status($("statusDiscover"), `Opened ${queries.length} tabs`);
  });

  $("hideOpenedBtn").addEventListener("click", () => {
    let hidden = 0;
    $("queryList").querySelectorAll(".query-item").forEach(el => {
      if (el.style.opacity === "0.4") { el.style.display = "none"; hidden++; }
    });
    status($("statusDiscover"), `Hidden ${hidden}`);
  });

  // ─── SETTINGS ───
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
    status($("statusSettings"), `Exported ${all.length} leads as JSON`);
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
        if (!Array.isArray(imported)) throw new Error("Invalid format");
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
        await new Promise(resolve => chrome.storage.local.set({ [STORAGE_KEY]: curr }, resolve));
        status($("statusSettings"), `Imported ${added} new leads (${imported.length - added} duplicates skipped)`);
        renderLeads(curr);
      } catch (err) {
        status($("statusSettings"), "Import failed: invalid file", true);
      }
    };
    input.click();
  });
});
