#!/usr/bin/env python3
"""
Naggar Analytics Lead Collector — CLI

Usage:
    python cli.py url <linkedin_url> [--output leads.xlsx] [--source manual]
    python cli.py batch <urls_file> [--output leads.xlsx] [--source linkedin_search]
    python cli.py salesnav <csv_file> [--output leads.xlsx]
    python cli.py merge <existing.xlsx> <new_urls_file> [--output leads.xlsx]
    python cli.py list-sources
"""

import asyncio
import sys
import argparse
from pathlib import Path
from typing import List

from src.collector import (
    parse_urls_from_text, read_urls_from_file,
    parse_sales_navigator_csv, build_lead_from_url,
)
from src.classifier import enrich_lead
from src.exporter import append_leads, merge_leads, write_leads, read_leads
from src.models import Lead
from src.scraper import auto_discover, auto_discover_from_network, DEFAULT_SEARCHES


def cmd_url(url: str, output: str, source: str):
    lead = build_lead_from_url(url, source=source)
    lead = enrich_lead(lead)
    n = append_leads(output, [lead])
    print(f"Added {n} lead to {output}")
    print(f"  Name:  {lead.full_name or '(needs manual fill)'}")
    print(f"  Type:  {lead.profile_type}")
    print(f"  Score: {lead.score}")
    print(f"  URL:   {lead.profile_url}")


def cmd_batch(file_path: str, output: str, source: str):
    urls = read_urls_from_file(file_path)
    if not urls:
        print("No LinkedIn URLs found in file.")
        return
    leads = []
    for url in urls:
        lead = build_lead_from_url(url, source=source)
        lead = enrich_lead(lead)
        leads.append(lead)
    n = append_leads(output, leads)
    print(f"Found {len(urls)} URLs, added {n} new leads to {output}")


def cmd_salesnav(file_path: str, output: str):
    leads = parse_sales_navigator_csv(file_path)
    for lead in leads:
        lead = enrich_lead(lead)
    n = append_leads(output, leads)
    print(f"Imported {n} Sales Navigator leads into {output}")


def cmd_merge(existing: str, new_file: str, output: str):
    urls = read_urls_from_file(new_file)
    leads = [build_lead_from_url(url) for url in urls]
    for lead in leads:
        enrich_lead(lead)
    n = merge_leads(existing, leads)
    print(f"Merged {n} new leads (skipped duplicates) into {output or existing}")


def cmd_discover(
    queries: List[str] = None,
    max_per_query: int = 20,
    location: str = "",
    output: str = "raw_leads.xlsx",
):
    print("=" * 60)
    print("  NAGGAR LEAD DISCOVERY TOOL")
    print("=" * 60)
    print()
    print("  SAFE MODE: only scrapes search result cards")
    print("  Does NOT visit profiles (no notifications sent)")
    print("  Does NOT send connection requests or messages")
    print("  Your password NEVER goes to this tool")
    print()
    print(f"  Output: {output} (review this file before any outreach)")
    print("=" * 60)
    print()

    asyncio.run(
        auto_discover(
            queries=queries,
            max_per_query=max_per_query,
            location=location,
            output=output,
        )
    )


def cmd_network(my_profile_url: str, max_connections: int = 100, output: str = "network_leads.xlsx"):
    asyncio.run(
        auto_discover_from_network(
            my_profile_url=my_profile_url,
            max_connections=max_connections,
            output=output,
        )
    )


def cmd_list_sources():
    print("Naggar Analytics Lead Collector")
    print("================================")
    print()
    print(" SAFE — does NOT send connection requests or messages")
    print(" SAFE — does NOT visit individual profiles")
    print()
    print("Available commands:")
    print("  url       Add a single LinkedIn URL")
    print("  batch     Add multiple URLs from a text file")
    print("  salesnav  Import a Sales Navigator CSV export")
    print("  merge     Merge new URLs into existing file (no duplicates)")
    print("  discover  Auto-search LinkedIn for leads")
    print("  network   Scan your LinkedIn connections for leads")
    print("  list-sources  Show this help")
    print()
    print("Typical sources:")
    print("  manual              Manually copied from LinkedIn")
    print("  linkedin_search     LinkedIn search results")
    print("  linkedin_search_mcp LinkedIn MCP search")
    print("  sales_navigator     Sales Navigator export")
    print("  initiative_*        Specific initiative (kaust, biostruct, etc.)")


def main():
    parser = argparse.ArgumentParser(description="Naggar Analytics Lead Collector")
    parser.add_argument("--output", default="leads.xlsx", help="Output Excel file")
    sub = parser.add_subparsers(dest="command")

    p_url = sub.add_parser("url", help="Add single LinkedIn URL")
    p_url.add_argument("url", help="LinkedIn profile URL")
    p_url.add_argument("--source", default="manual")

    p_batch = sub.add_parser("batch", help="Add URLs from a text file")
    p_batch.add_argument("file", help="Text file with LinkedIn URLs")
    p_batch.add_argument("--source", default="linkedin_search")

    p_sn = sub.add_parser("salesnav", help="Import Sales Navigator CSV")
    p_sn.add_argument("file", help="Sales Navigator CSV export")

    p_merge = sub.add_parser("merge", help="Merge new URLs into existing file")
    p_merge.add_argument("existing", help="Existing Excel file")
    p_merge.add_argument("new_file", help="Text file with new URLs")
    p_merge.add_argument("--output", help="Output file (default: overwrite existing)")

    p_disc = sub.add_parser("discover", help="Auto-search LinkedIn for leads (SAFE mode)")
    p_disc.add_argument("--queries", nargs="+", default=DEFAULT_SEARCHES,
                        help="Search queries (default: academic researcher searches)")
    p_disc.add_argument("--max-per-query", type=int, default=20,
                        help="Max results per query (default: 20)")
    p_disc.add_argument("--location", default="",
                        choices=["", "Saudi Arabia", "UAE", "Egypt", "USA", "UK", "Germany", "Worldwide"],
                        help="Filter by location")
    p_disc.add_argument("--output", default="raw_leads.xlsx",
                        help="Output file (default: raw_leads.xlsx)")

    p_net = sub.add_parser("network", help="Scan YOUR LinkedIn connections for leads")
    p_net.add_argument("profile_url", help="Your LinkedIn profile URL")
    p_net.add_argument("--max", type=int, default=100, help="Max connections to scan (default: 100)")
    p_net.add_argument("--output", default="network_leads.xlsx", help="Output file")

    sub.add_parser("list-sources", help="Show available sources")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    if args.command == "url":
        cmd_url(args.url, args.output, args.source)
    elif args.command == "batch":
        cmd_batch(args.file, args.output, args.source)
    elif args.command == "salesnav":
        cmd_salesnav(args.file, args.output)
    elif args.command == "merge":
        cmd_merge(args.existing, args.new_file, args.output or args.existing)
    elif args.command == "discover":
        cmd_discover(
            queries=args.queries,
            max_per_query=args.max_per_query,
            location=args.location,
            output=args.output,
        )
    elif args.command == "network":
        cmd_network(args.profile_url, args.max, args.output)
    elif args.command == "list-sources":
        cmd_list_sources()


if __name__ == "__main__":
    main()
