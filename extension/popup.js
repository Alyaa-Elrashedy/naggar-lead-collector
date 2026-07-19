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
  status($("statusLeads"), `Downloaded ${leads.length} leads — open CSV in Excel`);
}

// ─── Tab switching ───
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    $(`panel-${tab.dataset.tab}`).classList.add("active");
  });
});

// ─── Init ───
document.addEventListener("DOMContentLoaded", async () => {
  let leads = await getLeads();
  $("leadCount").textContent = leads.length;

  // Download CSV
  $("downloadBtn").addEventListener("click", () => {
    getLeads().then(downloadCSV);
  });

  // Clear
  $("clearBtn").addEventListener("click", async () => {
    const curr = await getLeads();
    if (curr.length === 0) { status($("statusLeads"), "No leads to clear"); return; }
    if (!confirm(`Delete all ${curr.length} saved leads?`)) return;
    await new Promise(resolve => chrome.storage.local.set({ [STORAGE_KEY]: [] }, resolve));
    $("leadCount").textContent = "0";
    status($("statusLeads"), "All leads cleared");
  });

  // Extract current profile
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
      $("leadCount").textContent = curr.length;
      status($("statusLeads"), `Saved: ${lead.full_name} (${lead.profile_type}, score: ${lead.score})`);
    });
  });

  // ─── AUTO DISCOVER ───
  const queries = await new Promise(resolve => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "getQueries" }, response => {
          resolve(response?.queries || []);
        });
      } else {
        resolve([]);
      }
    });
  });

  // Fallback: define queries inline
  const fallbackQueries = [
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
    {label:"VPs - Research",url:"https://www.linkedin.com/search/results/people/?keywords=vice%20president%20research%20university"},
    {label:"Lab Directors",url:"https://www.linkedin.com/search/results/people/?keywords=lab%20director%20university"},
    {label:"Department Chairs",url:"https://www.linkedin.com/search/results/people/?keywords=department%20chair%20biostatistics"},
    {label:"Research Program Coordinators",url:"https://www.linkedin.com/search/results/people/?keywords=research%20program%20coordinator"},
    {label:"Research Development Officers",url:"https://www.linkedin.com/search/results/people/?keywords=research%20development%20officer"},
    {label:"Biostatisticians - Pharma",url:"https://www.linkedin.com/search/results/people/?keywords=biostatistician%20pharmaceutical"},
    {label:"Clinical Trial Managers",url:"https://www.linkedin.com/search/results/people/?keywords=clinical%20trial%20manager"},
    {label:"Clinical Research Associates",url:"https://www.linkedin.com/search/results/people/?keywords=clinical%20research%20associate"},
    {label:"Medical Affairs Directors",url:"https://www.linkedin.com/search/results/people/?keywords=medical%20affairs%20director"},
    {label:"Regulatory Affairs",url:"https://www.linkedin.com/search/results/people/?keywords=regulatory%20affairs%20biostatistics"},
    {label:"CRO - Business Development",url:"https://www.linkedin.com/search/results/people/?keywords=CRO%20business%20development"},
    {label:"Pharma R&D Managers",url:"https://www.linkedin.com/search/results/people/?keywords=pharma%20R%26D%20manager"},
    {label:"Biotech Founders",url:"https://www.linkedin.com/search/results/people/?keywords=biotech%20founder"},
    {label:"Biostatistics Directors",url:"https://www.linkedin.com/search/results/people/?keywords=director%20biostatistics"},
    {label:"Clinical Data Management",url:"https://www.linkedin.com/search/results/people/?keywords=clinical%20data%20management"},
    {label:"Co-Founders - HealthTech",url:"https://www.linkedin.com/search/results/people/?keywords=healthtech%20co-founder"},
    {label:"CEOs - Research Services",url:"https://www.linkedin.com/search/results/people/?keywords=CEO%20research%20services"},
    {label:"Founders - EdTech",url:"https://www.linkedin.com/search/results/people/?keywords=edtech%20founder"},
    {label:"Capacity Building - Research",url:"https://www.linkedin.com/search/results/people/?keywords=research%20capacity%20building"},
    {label:"Training Directors - Research",url:"https://www.linkedin.com/search/results/people/?keywords=research%20training%20director"},
    {label:"Consortium Leaders",url:"https://www.linkedin.com/search/results/people/?keywords=research%20consortium%20leader"},
    {label:"Workshop Organizers",url:"https://www.linkedin.com/search/results/people/?keywords=research%20workshop%20organizer"},
    {label:"Innovation Center Directors",url:"https://www.linkedin.com/search/results/people/?keywords=innovation%20center%20director"},
    {label:"Science Park Managers",url:"https://www.linkedin.com/search/results/people/?keywords=science%20park%20manager"},
    {label:"Saudi - Professors",url:"https://www.linkedin.com/search/results/people/?keywords=professor&geoUrn=101282733"},
    {label:"Saudi - Researchers",url:"https://www.linkedin.com/search/results/people/?keywords=researcher&geoUrn=101282733"},
    {label:"Saudi - PhD Candidates",url:"https://www.linkedin.com/search/results/people/?keywords=PhD%20candidate&geoUrn=101282733"},
    {label:"KAUST - Researchers",url:"https://www.linkedin.com/search/results/people/?keywords=KAUST%20researcher"},
    {label:"UAE - Professors",url:"https://www.linkedin.com/search/results/people/?keywords=professor&geoUrn=101194590"},
    {label:"UAE - Researchers",url:"https://www.linkedin.com/search/results/people/?keywords=researcher&geoUrn=101194590"},
    {label:"UAE - PhD Candidates",url:"https://www.linkedin.com/search/results/people/?keywords=PhD%20candidate&geoUrn=101194590"},
    {label:"Egypt - Professors",url:"https://www.linkedin.com/search/results/people/?keywords=professor&geoUrn=102100715"},
    {label:"Egypt - Researchers",url:"https://www.linkedin.com/search/results/people/?keywords=researcher&geoUrn=102100715"},
    {label:"Egypt - PhD Candidates",url:"https://www.linkedin.com/search/results/people/?keywords=PhD%20candidate&geoUrn=102100715"},
    {label:"USA - Biostatistics Professors",url:"https://www.linkedin.com/search/results/people/?keywords=biostatistics%20professor&geoUrn=103644278"},
    {label:"USA - Epidemiology Researchers",url:"https://www.linkedin.com/search/results/people/?keywords=epidemiology%20researcher&geoUrn=103644278"},
    {label:"USA - Public Health",url:"https://www.linkedin.com/search/results/people/?keywords=public%20health%20researcher&geoUrn=103644278"},
    {label:"UK - Biostatistics",url:"https://www.linkedin.com/search/results/people/?keywords=biostatistics%20researcher&geoUrn=101165590"},
    {label:"UK - Epidemiology",url:"https://www.linkedin.com/search/results/people/?keywords=epidemiology%20researcher&geoUrn=101165590"},
    {label:"UK - Public Health",url:"https://www.linkedin.com/search/results/people/?keywords=public%20health%20researcher&geoUrn=101165590"},
    {label:"Germany - Researchers",url:"https://www.linkedin.com/search/results/people/?keywords=researcher&geoUrn=101282230"},
    {label:"Germany - Biostatistics",url:"https://www.linkedin.com/search/results/people/?keywords=biostatistics&geoUrn=101282230"},
    {label:"Graduate Students - Biostatistics",url:"https://www.linkedin.com/search/results/people/?keywords=master%20student%20biostatistics"},
    {label:"Research Assistants",url:"https://www.linkedin.com/search/results/people/?keywords=research%20assistant%20biostatistics"},
    {label:"Teaching Assistants - Statistics",url:"https://www.linkedin.com/search/results/people/?keywords=teaching%20assistant%20statistics"},
  ];
  const allQueries = queries.length > 0 ? queries : fallbackQueries;

  function renderQueries(list) {
    $("queryList").innerHTML = list.map((q, i) =>
      `<div class="query-item" data-idx="${i}">
        <span class="query-label">${q.label}</span>
        <span class="query-open">Open</span>
      </div>`
    ).join("");

    $("queryList").querySelectorAll(".query-item").forEach(el => {
      const idx = parseInt(el.dataset.idx);
      const q = list[idx];
      el.querySelector(".query-open").addEventListener("click", (e) => {
        e.stopPropagation();
        chrome.tabs.create({ url: q.url });
        el.style.opacity = "0.4";
        status($("statusDiscover"), `Opened: ${q.label}`);
      });
    });
  }

  renderQueries(allQueries);
  $("queryList").querySelectorAll(".query-item").length > 0 &&
    status($("statusDiscover"), `${allQueries.length} search queries ready`);

  // Open all
  $("openAllBtn").addEventListener("click", () => {
    allQueries.forEach(q => chrome.tabs.create({ url: q.url }));
    status($("statusDiscover"), `Opened ${allQueries.length} tabs`);
  });

  // Hide opened
  $("hideOpenedBtn").addEventListener("click", () => {
    const items = $("queryList").querySelectorAll(".query-item");
    let hidden = 0;
    items.forEach(el => {
      if (el.style.opacity === "0.4") { el.style.display = "none"; hidden++; }
    });
    status($("statusDiscover"), `Hidden ${hidden} opened queries`);
  });
});
