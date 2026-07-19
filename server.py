#!/usr/bin/env python3
"""
Naggar Lead Collector — Local Server
Receives leads from the Chrome extension and saves to Excel.

Run with:  python server.py
"""

import sys
from pathlib import Path
from datetime import date
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import webbrowser

sys.path.insert(0, str(Path(__file__).parent))
from src.models import Lead
from src.classifier import enrich_lead
from src.outreach import generate_message
from src.exporter import append_leads, merge_leads, read_leads

OUTPUT_FILE = str(Path.home() / "Downloads" / "naggar_leads.xlsx")
PORT = 8899

TOTAL_LEADS = 0


class LeadHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f"[server] {args[0]} {args[1]} {args[2]}")

    def _send_json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_OPTIONS(self):
        self._send_json({})

    def do_GET(self):
        global TOTAL_LEADS
        if self.path == "/health":
            self._send_json({"status": "ok", "total_leads": TOTAL_LEADS})
        elif self.path == "/open-folder":
            downloads = Path.home() / "Downloads"
            webbrowser.open(str(downloads))
            self._send_json({"status": "ok"})
        elif self.path == "/":
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(f"""
            <html><body style="font-family:sans-serif;padding:40px">
            <h1> Naggar Lead Server</h1>
            <p>Server is running. Extension can save leads.</p>
            <p>Leads saved: <b>{TOTAL_LEADS}</b></p>
            <p>File: <code>{OUTPUT_FILE}</code></p>
            <hr>
            <h3>Instructions</h3>
            <ol>
              <li>Go to LinkedIn and browse profiles</li>
              <li>Click <b>"Save Lead"</b> button on any profile</li>
              <li>Or click <b>"Save All Visible"</b> on search results</li>
              <li>Leads are saved to the Excel file above</li>
            </ol>
            </body></html>
            """.encode())
        else:
            self._send_json({"error": "not found"}, 404)

    def do_POST(self):
        global TOTAL_LEADS
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode()

        if self.path == "/save_lead":
            data = json.loads(body)
            lead = Lead(
                date_discovered=date.today().isoformat(),
                source="extension_profile",
                profile_url=data.get("profile_url", ""),
                full_name=data.get("full_name", ""),
                title=data.get("title", ""),
                company_institution=data.get("company_institution", ""),
                location=data.get("location", ""),
                linkedin_username=data.get("linkedin_username", ""),
            )
            enrich_lead(lead)
            lead.outreach_message = generate_message(lead)
            n = merge_leads(OUTPUT_FILE, [lead])
            TOTAL_LEADS += n
            saved = n > 0
            self._send_json({
                "saved": saved,
                "name": lead.full_name,
                "type": lead.profile_type,
                "score": lead.score,
                "total": TOTAL_LEADS,
            })

        elif self.path == "/save_batch":
            data = json.loads(body)
            leads_data = data.get("leads", [])
            leads = []
            for d in leads_data:
                url = d.get("profile_url", "")
                username = Lead.extract_username(url)
                lead = Lead(
                    date_discovered=date.today().isoformat(),
                    source="extension_search",
                    profile_url=url,
                    full_name=d.get("linkText", ""),
                    title="",
                    company_institution="",
                    location="",
                    linkedin_username=username,
                )
                enrich_lead(lead)
                lead.outreach_message = generate_message(lead)
                leads.append(lead)

            n = merge_leads(OUTPUT_FILE, leads)
            TOTAL_LEADS += n
            self._send_json({
                "saved": n,
                "total": len(leads_data),
                "total_leads": TOTAL_LEADS,
            })

        else:
            self._send_json({"error": "not found"}, 404)


def main():
    print("=" * 60)
    print("  NAGGAR LEAD SERVER")
    print("=" * 60)
    print()
    print(f"  Server running at: http://localhost:{PORT}")
    print(f"  Saving leads to:   {OUTPUT_FILE}")
    print()
    print("  HOW TO USE:")
    print("  1. Install the Chrome extension")
    print("  2. Go to LinkedIn and browse profiles")
    print("  3. Click 'Save Lead' button on any profile")
    print("  4. Or click 'Save All Visible' on search results")
    print()
    print("  Press Ctrl+C to stop")
    print("=" * 60)

    server = HTTPServer(("localhost", PORT), LeadHandler)
    webbrowser.open(f"http://localhost:{PORT}")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[server stopped]")
        server.server_close()


if __name__ == "__main__":
    main()
