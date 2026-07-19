import asyncio
import json
import time
from pathlib import Path
from typing import List, Optional, Dict
from datetime import date

from playwright.async_api import async_playwright, Page, Browser

from .models import Lead
from .classifier import enrich_lead
from .outreach import generate_message

SEARCH_URL = "https://www.linkedin.com/search/results/people/"

DEFAULT_SEARCHES = [
    # ── Segment A: Academic Researchers ──
    "Assistant Professor biostatistics",
    "Assistant Professor epidemiology",
    "Assistant Professor statistics",
    "Associate Professor bioinformatics",
    "Associate Professor public health",
    "Professor biostatistics",
    "Professor epidemiology",
    "Professor research methodology",
    "PhD student biostatistics",
    "PhD candidate epidemiology",
    "postdoctoral researcher biostatistics",
    "lecturer medical statistics",
    "researcher biostatistics",
    "research fellow public health",
    "university professor research",
    # ── Segment B: Institutional Decision Makers ──
    "Head of Biostatistics",
    "Director of Research",
    "Dean of research",
    "Dean of scientific research",
    "Vice Dean research",
    "Head of Research Department",
    "Director of Research Institute",
    "Research Center Director",
    "Head of Epidemiology",
    "Chair Department of Biostatistics",
    # ── Pharma & Biotech ──
    "Biostatistician pharmaceutical",
    "Biostatistician clinical trials",
    "Senior Biostatistician pharma",
    "Clinical Trial Manager",
    "Clinical Research Director",
    "Head of Clinical Development",
    "Director Biostatistics pharma",
    "Principal Biostatistician",
    "Statistical Programmer pharma",
    "Biostatistics Manager CRO",
    "Clinical Data Manager",
    "VP Clinical Development",
    "Medical Director clinical trials",
    "Head of Medical Affairs",
    "Director of Biometrics",
    # ── CRO & Contract Research ──
    "CRO biostatistics",
    "Contract Research Organization manager",
    "Senior Clinical Research Associate",
    "Clinical Operations Director",
    "Head of Biometrics CRO",
    "Director of Biostatistics CRO",
    # ── Global Health & Public Health ──
    "Epidemiologist global health",
    "Public Health researcher",
    "Senior Epidemiologist",
    "Global Health Director",
    "Infectious Disease researcher",
    "Vaccine research scientist",
    "Genomic epidemiology",
    "Bioinformatics scientist",
    # ── Research Institutes & Hospitals ──
    "Research scientist hospital",
    "Clinical research institute director",
    "Head of medical research",
    "Biostatistician academic medical center",
]

LOCATION_FILTERS = {
    "Saudi Arabia": "102382553",
    "UAE": "102713980",
    "Egypt": "101734865",
    "USA": "103644278",
    "UK": "101165590",
    "Germany": "101282230",
    "Worldwide": "",
}

SAFETY_DELAY_BETWEEN_SEARCHES = 15
SAFETY_DELAY_BETWEEN_SCROLLS = 5
MAX_SCROLLS = 3


class LinkedInScraper:
    def __init__(self, cookies_dir: str = "data/session"):
        self.cookies_dir = Path(cookies_dir)
        self.cookies_dir.mkdir(parents=True, exist_ok=True)
        self.cookie_file = self.cookies_dir / "linkedin_cookies.json"
        self._playwright = None
        self._browser_headless = None
        self.browser: Optional[Browser] = None

    async def _close_browser(self):
        if self.browser:
            try:
                await self.browser.close()
            except:
                pass
            self.browser = None
            self._browser_headless = None

    async def _get_browser(self, headless: bool = True):
        if self.browser and self.browser.is_connected() and self._browser_headless == headless:
            return self.browser
        await self._close_browser()
        if not self._playwright:
            self._playwright = await async_playwright().start()
        self.browser = await self._playwright.chromium.launch(
            headless=headless,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
            ],
        )
        self._browser_headless = headless
        return self.browser

    async def _new_context(self, headless: bool = True):
        browser = await self._get_browser(headless=headless)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
        )
        if self.cookie_file.exists():
            with open(self.cookie_file) as f:
                cookies = json.load(f)
            await context.add_cookies(cookies)
        return context

    async def save_cookies(self, page: Page):
        cookies = await page.context.cookies()
        with open(self.cookie_file, "w") as f:
            json.dump(cookies, f)
        print(f"[cookies saved] {len(cookies)} cookies")

    async def ensure_logged_in(self) -> bool:
        """
        Check saved cookies first. If valid, use them headless.
        If not, open a VISIBLE browser for manual login.
        Your password goes to LinkedIn.com — NOT to this tool.
        """
        # Try cookies first
        if self.cookie_file.exists():
            print("[checking saved cookies...]")
            try:
                context = await self._new_context(headless=True)
                page = await context.new_page()
                await page.goto("https://www.linkedin.com/feed", wait_until="domcontentloaded")
                await asyncio.sleep(2)
                if "/feed" in page.url:
                    print("[logged in via saved cookies]")
                    await self.save_cookies(page)
                    await page.close()
                    return True
                await page.close()
            except Exception as e:
                print(f"[cookie check failed: {e}]")
            # Cookies didn't work, close headless browser before opening visible one
            await self._close_browser()

        # Open visible browser for manual login
        print("=" * 60)
        print("  LINKEDIN LOGIN REQUIRED")
        print("=" * 60)
        print("  A browser window will open.")
        print("  Log in to LinkedIn MANUALLY in that window.")
        print("  Your password goes to LinkedIn.com — NOT to this tool.")
        print("  After you log in, come back here and press Enter.")
        print("=" * 60)

        context = await self._new_context(headless=False)
        page = await context.new_page()

        await page.goto("https://www.linkedin.com/login", wait_until="domcontentloaded")

        input("  Press Enter AFTER you finish logging in on the browser...")

        await asyncio.sleep(2)
        await self.save_cookies(page)
        print("[login successful, cookies saved for future runs]")
        await page.close()
        return True

    async def search_people_safe(
        self, query: str, max_results: int = 20, location_geo: str = ""
    ) -> List[Dict]:
        """
        SAFE mode: only scrapes search result cards.
        Does NOT visit individual profiles.
        No notifications are sent to anyone.
        """
        context = await self._new_context()
        page = await context.new_page()

        params = f"keywords={query.replace(' ', '+')}&origin=GLOBAL_SEARCH_HEADER"
        if location_geo:
            params += f"&geoUrn={location_geo}"

        url = f"{SEARCH_URL}?{params}"
        print(f"[search] {query}")
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=15000)
        except Exception as e:
            print(f"  [search page error] {e}")
            await page.close()
            return []
        await asyncio.sleep(4)

        # DEBUG: save page content to understand structure
        import json as _json

        debug_info = await page.evaluate("""
            () => {
                // Check all links
                const allLinks = Array.from(document.querySelectorAll('a'));
                const profileLinks = allLinks
                    .filter(a => (a.href || '').includes('/in/') && !a.href.includes('/search/'))
                    .map(a => ({ href: a.href, text: (a.innerText || a.textContent || '').trim().slice(0, 100) }));
                
                // Get visible text of the page
                const bodyText = (document.body.innerText || '').trim();
                const lines = bodyText.split('\\n').filter(l => l.trim()).map(l => l.trim());
                
                // Count profile links
                const allProfileCount = profileLinks.length;
                
                return JSON.stringify({
                    profileLinkCount: allProfileCount,
                    profileLinks: profileLinks.slice(0, 10),
                    totalLines: lines.length,
                    firstLines: lines.slice(0, 30),
                    url: window.location.href,
                });
            }
        """)

        debug = _json.loads(debug_info)
        print(f"  [debug] profile links on page: {debug['profileLinkCount']}")
        if debug['profileLinkCount'] == 0:
            print(f"  [debug] first 15 lines of page text:")
            for i, line in enumerate(debug['firstLines'][:15]):
                print(f"    {i}: {line[:120]}")
            print(f"  [debug] URL: {debug['url']}")

        if debug['profileLinkCount'] == 0:
            print("  [no profiles found on page]")
            await page.close()
            return []

        profiles = []
        seen_urls = set()

        for scroll in range(MAX_SCROLLS):
            if len(profiles) >= max_results:
                break

            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await asyncio.sleep(SAFETY_DELAY_BETWEEN_SCROLLS)

            # Extract all profile links and surrounding text via JavaScript
            extracted = await page.evaluate(f"""
                () => {{
                    const results = [];
                    const seen = new Set();
                    
                    // Get ALL links, then filter for profile URLs
                    const allLinks = document.querySelectorAll('a');
                    
                    allLinks.forEach(link => {{
                        const href = link.href || '';
                        if (!href.includes('/in/')) return;
                        if (href.includes('/search/') || href.includes('/mynetwork/') || href.includes('/sales/')) return;
                        
                        const cleanUrl = href.split('?')[0].split('#')[0];
                        if (seen.has(cleanUrl)) return;
                        seen.add(cleanUrl);
                        
                        // Get the text content of the link
                        const linkText = (link.innerText || link.textContent || '').trim();
                        if (!linkText) return;
                        
                        // Try to find the card - walk up the DOM tree
                        let card = link;
                        let cardText = linkText;
                        for (let i = 0; i < 8; i++) {{
                            if (card.parentElement) {{
                                card = card.parentElement;
                                const t = (card.innerText || '').trim();
                                if (t && t.length > cardText.length && t.length < 500) {{
                                    cardText = t;
                                }}
                            }}
                        }}
                        
                        results.push({{
                            url: cleanUrl,
                            linkText: linkText,
                            cardText: cardText.slice(0, 500),
                        }});
                    }});
                    
                    return JSON.stringify(results.slice(0, {max_results * 2}));
                }}
            """)

            raw_results = _json.loads(extracted)

            for r in raw_results:
                url = r["url"]
                if url in seen_urls:
                    continue
                seen_urls.add(url)

                lines = [l.strip() for l in r["cardText"].split("\n") if l.strip()]
                name = r["linkText"]

                # Find name position in lines and extract surrounding context
                title = ""
                company = ""
                location = ""
                for idx, line in enumerate(lines):
                    if name and (line == name or line.startswith(name) or name.startswith(line)):
                        if idx + 1 < len(lines):
                            title = lines[idx + 1]
                        if idx + 2 < len(lines):
                            extra = lines[idx + 2]
                            if "," in extra and len(extra) < 60:
                                location = extra
                            else:
                                company = extra
                        if idx + 3 < len(lines) and not location:
                            extra = lines[idx + 3]
                            if "," in extra and len(extra) < 60:
                                location = extra
                        break

                if not title and len(lines) > 1:
                    title = lines[1]

                profiles.append({
                    "profile_url": url,
                    "full_name": name,
                    "title": title,
                    "company_institution": company,
                    "location": location,
                })

            if len(raw_results) == 0:
                break

        print(f"  found {len(profiles)} profiles")
        await page.close()
        return profiles

    async def run_searches_safe(
        self,
        queries: List[str],
        max_per_query: int = 20,
        location: str = "",
        output_file: str = "raw_leads.xlsx",
    ) -> int:
        from .exporter import merge_leads

        total = 0
        geo = LOCATION_FILTERS.get(location, "")
        all_results = []

        for i, query in enumerate(queries):
            print(f"\n--- Query {i+1}/{len(queries)}: {query} ---")
            results = await self.search_people_safe(query, max_results=max_per_query, location_geo=geo)
            all_results.extend(results)

            if i < len(queries) - 1:
                print(f"[waiting {SAFETY_DELAY_BETWEEN_SEARCHES}s before next search...]")
                await asyncio.sleep(SAFETY_DELAY_BETWEEN_SEARCHES)

        # Deduplicate by URL
        seen = set()
        unique = []
        for r in all_results:
            if r["profile_url"] not in seen:
                seen.add(r["profile_url"])
                unique.append(r)

        leads = []
        for r in unique:
            lead = Lead(
                date_discovered=date.today().isoformat(),
                source=f"linkedin_auto_discovery",
                profile_url=r.get("profile_url", ""),
                full_name=r.get("full_name", ""),
                title=r.get("title", ""),
                company_institution=r.get("company_institution", ""),
                location=r.get("location", ""),
                linkedin_username=Lead.extract_username(r.get("profile_url", "")),
            )
            enrich_lead(lead)
            lead.outreach_message = generate_message(lead)
            leads.append(lead)

        n = merge_leads(output_file, leads)
        total += n
        print(f"\n[summary] {len(unique)} unique profiles found, {n} new leads saved to {output_file}")
        return total

    async def scan_my_network(
        self, my_profile_url: str, max_connections: int = 100
    ) -> List[Dict]:
        """
        Visits YOUR connections page, extracts your connections' profile data.
        Does NOT send any requests or notifications.
        """
        username = Lead.extract_username(my_profile_url)
        if not username:
            print("[error] could not extract username from your profile URL")
            return []

        # Try going to the logged-in user's own profile first
        my_profile_page = f"https://www.linkedin.com/in/{username}/"
        print(f"[scanning network] opening your profile: {my_profile_page}")

        context = await self._new_context()
        page = await context.new_page()

        try:
            await page.goto(my_profile_page, wait_until="domcontentloaded", timeout=15000)
        except Exception as e:
            print(f"  [could not load profile page] {e}")
            await page.close()
            return []
        await asyncio.sleep(3)
        print(f"  [current URL after opening profile] {page.url}")

        # Try to find and click the connections link on your profile
        connections_found = False
        import json as _json

        debug_info = await page.evaluate("""
            () => {
                const bodyText = (document.body.innerText || '').trim();
                const lines = bodyText.split('\\n').filter(l => l.trim()).map(l => l.trim());
                // Look for "connections" near numbers
                const connLines = lines.filter(l => /\\d+.*connection/i.test(l) || /connection.*\\d+/i.test(l) || /\\d+.*Connections?/i.test(l));
                // Check all links
                const allLinks = Array.from(document.querySelectorAll('a'));
                const connLinks = allLinks.filter(a => /connection/i.test(a.innerText || a.textContent || '')).map(a => ({ href: a.href, text: (a.innerText || '').trim().slice(0, 100) }));
                return JSON.stringify({
                    lines: lines.slice(0, 30),
                    connLines: connLines,
                    connLinks: connLinks,
                    url: window.location.href,
                });
            }
        """)
        debug = _json.loads(debug_info)
        print(f"  [debug profile page] URL: {debug['url']}")
        print(f"  [debug] connection-related lines: {debug['connLines']}")
        print(f"  [debug] connection links found: {len(debug['connLinks'])}")
        if debug['connLinks']:
            for cl in debug['connLinks'][:3]:
                print(f"    -> {cl}")

        # Navigate to connections page
        connections_urls = [
            f"https://www.linkedin.com/in/{username}/connections/",
            f"https://www.linkedin.com/in/{username}/details/connections/",
            f"https://www.linkedin.com/mynetwork/conn/",
            f"https://www.linkedin.com/mynetwork/",
        ]

        profiles = []
        seen_urls = set()

        for conn_url in connections_urls:
            print(f"  [trying] {conn_url}")
            try:
                await page.goto(conn_url, wait_until="domcontentloaded", timeout=15000)
            except Exception as e:
                print(f"  [timeout/error] {e}")
                continue
            await asyncio.sleep(3)

            # Check if redirected (might mean page doesn't exist)
            current_url = page.url
            print(f"  [current URL] {current_url}")
            if current_url == conn_url or "/connections/" in current_url or "/mynetwork/" in current_url:
                pass  # Good, we're on the right page
            else:
                print(f"  [redirected away from connections page]")
                continue

            page_text = await page.evaluate("() => document.body.innerText.slice(0, 1000)")

            # Debug: print first few lines
            lines_preview = [l.strip() for l in page_text.split('\n') if l.strip()][:10]
            print(f"  [page content preview]:")
            for l in lines_preview:
                print(f"    {l[:120]}")

            # Check for profile links
            profile_count = await page.evaluate("""
                () => {
                    const links = document.querySelectorAll('a[href*="/in/"]');
                    const filtered = Array.from(links).filter(a => {
                        const h = a.href || '';
                        return h.includes('/in/') && !h.includes('/search/') && !h.includes('/mynetwork/');
                    });
                    return filtered.length;
                }
            """)
            print(f"  [profile links on page] {profile_count}")

            if profile_count == 0:
                continue

            # Scroll and extract
            for scroll in range(5):
                if len(profiles) >= max_connections:
                    break

                await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                await asyncio.sleep(3)

                extracted = await page.evaluate(f"""
                    () => {{
                        const results = [];
                        const seen = new Set();
                        const links = document.querySelectorAll('a[href*="/in/"]');
                        links.forEach(link => {{
                            const href = link.href || '';
                            if (!href.includes('/in/')) return;
                            if (href.includes('/search/') || href.includes('/mynetwork/') ||
                                href.includes('/sales/') || href.includes('/edit/')) return;
                            const cleanUrl = href.split('?')[0];
                            if (seen.has(cleanUrl)) return;
                            seen.add(cleanUrl);
                            const linkText = (link.innerText || link.textContent || '').trim();
                            if (!linkText || linkText.length < 2) return;
                            let card = link;
                            let cardText = linkText;
                            for (let i = 0; i < 6; i++) {{
                                if (card.parentElement) {{
                                    card = card.parentElement;
                                    const t = (card.innerText || '').trim();
                                    if (t.length > cardText.length && t.length < 600) {{
                                        cardText = t;
                                    }}
                                }}
                            }}
                            results.push({{
                                url: cleanUrl,
                                linkText: linkText,
                                cardText: cardText.slice(0, 600),
                            }});
                        }});
                        return JSON.stringify(results.slice(0, {max_connections}));
                    }}
                """)

                raw = _json.loads(extracted)
                added = 0
                for r in raw:
                    url = r["url"]
                    if url in seen_urls:
                        continue
                    seen_urls.add(url)
                    lines = [l.strip() for l in r["cardText"].split("\n") if l.strip()]
                    name = r["linkText"]
                    title = ""
                    company = ""
                    location = ""
                    for idx, line in enumerate(lines):
                        if name and (line == name or name.startswith(line) or line.startswith(name)):
                            if idx + 1 < len(lines):
                                title = lines[idx + 1]
                            if idx + 2 < len(lines):
                                extra = lines[idx + 2]
                                if "," in extra and len(extra) < 60:
                                    location = extra
                                else:
                                    company = extra
                            break
                    if not title and len(lines) > 1:
                        title = lines[1]
                    profiles.append({
                        "profile_url": url,
                        "full_name": name,
                        "title": title,
                        "company_institution": company,
                        "location": location,
                    })
                    added += 1

                print(f"  [scroll {scroll+1}] found {added} more (total: {len(profiles)})")
                if added == 0:
                    break

            if profiles:
                break

        await page.close()
        print(f"  [network scan complete] {len(profiles)} connections extracted")
        return profiles

    async def run_network_scan(
        self, my_profile_url: str, max_connections: int = 100, output_file: str = "network_leads.xlsx"
    ) -> int:
        from .exporter import merge_leads

        results = await self.scan_my_network(my_profile_url, max_connections=max_connections)
        if not results:
            print("  [no connections found]")
            return 0

        leads = []
        for r in results:
            lead = Lead(
                date_discovered=date.today().isoformat(),
                source="my_network",
                profile_url=r.get("profile_url", ""),
                full_name=r.get("full_name", ""),
                title=r.get("title", ""),
                company_institution=r.get("company_institution", ""),
                location=r.get("location", ""),
                linkedin_username=Lead.extract_username(r.get("profile_url", "")),
            )
            enrich_lead(lead)
            lead.outreach_message = generate_message(lead)
            leads.append(lead)

        n = merge_leads(output_file, leads)
        print(f"\n[network scan] {len(results)} connections found, {n} new leads saved to {output_file}")
        return n

    async def close(self):
        if self.browser and self.browser.is_connected():
            await self.browser.close()


async def auto_discover(
    queries: List[str] = None,
    max_per_query: int = 20,
    location: str = "",
    output: str = "raw_leads.xlsx",
):
    if queries is None:
        queries = DEFAULT_SEARCHES

    print("=" * 60)
    print("  NAGGAR LEAD DISCOVERY TOOL")
    print("  SAFE MODE: search results only, no profiles visited")
    print("  No connection requests or messages are sent")
    print("  Your password NEVER goes to this tool")
    print("=" * 60)

    scraper = LinkedInScraper()
    try:
        logged_in = await scraper.ensure_logged_in()
        if not logged_in:
            print("Cannot proceed without login.")
            return 0

        total = await scraper.run_searches_safe(queries, max_per_query, location, output)
        print(f"\nDone! {total} new leads saved to {output}")
        print(f"Review them in {output}, then decide who to contact manually.")
        return total
    finally:
        await scraper.close()


async def auto_discover_from_network(
    my_profile_url: str,
    max_connections: int = 100,
    output: str = "network_leads.xlsx",
):
    print("=" * 60)
    print("  NAGGAR NETWORK SCANNER")
    print("  Scans YOUR LinkedIn connections for potential leads")
    print("  No connection requests or messages are sent")
    print("  Your password NEVER goes to this tool")
    print("=" * 60)
    print(f"  Profile: {my_profile_url}")

    scraper = LinkedInScraper()
    try:
        logged_in = await scraper.ensure_logged_in()
        if not logged_in:
            print("Cannot proceed without login.")
            return 0

        total = await scraper.run_network_scan(my_profile_url, max_connections, output)
        print(f"\nDone! {total} leads saved to {output}")
        return total
    finally:
        await scraper.close()
