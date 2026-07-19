#!/usr/bin/env python3
"""
Naggar Analytics Lead Collector — Streamlit Web App

Run with:  streamlit run app.py
"""

import sys
from pathlib import Path
from datetime import date
from typing import List

import streamlit as st
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from src.models import Lead, LEAD_SCHEMA, PROFILE_TYPES, OUTREACH_STATUSES
from src.collector import (
    parse_urls_from_text, read_urls_from_file,
    parse_sales_navigator_csv, build_lead_from_url,
)
from src.classifier import enrich_lead, CLASSIFICATION_RULES
from src.outreach import generate_message
from src.exporter import read_leads, append_leads, write_leads, merge_leads
from src.scraper import LinkedInScraper, DEFAULT_SEARCHES, LOCATION_FILTERS

st.set_page_config(
    page_title="Naggar Lead Collector",
    page_icon="",
    layout="wide",
)

DEFAULT_OUTPUT = str(Path.home() / "Downloads" / "naggar_leads.xlsx")


def header():
    st.title(" Naggar Analytics — Lead Collector")
    st.markdown("Collect, classify, and export LinkedIn leads for Naggar Analytics CRM")


def sidebar_help():
    with st.sidebar:
        st.header("About")
        st.markdown(
            "This tool helps you collect potential leads from LinkedIn, "
            "classify them using the Naggar Analytics strategy framework, "
            "and export to your CRM Excel file.\n\n"
            "**Segments (from strategy doc):**\n"
            "- **A: Academic Researchers** — primary target\n"
            "- **B: Institutional Decision Makers** — secondary\n"
            "- **C: Ambassadors** — enabling\n\n"
            "**Sources:** manual, linkedin_search, sales_navigator, initiatives"
        )

        st.header("Classification Rules")
        for ptype, rules in CLASSIFICATION_RULES.items():
            with st.expander(f"{ptype} (score: {rules['score_range']})"):
                st.caption("Keywords: " + ", ".join(rules["keywords"][:5]))
                for pp in rules["pain_points"][:2]:
                    st.markdown(f"- {pp}")

        st.header("Output File")
        st.code(st.session_state.get("output_path", DEFAULT_OUTPUT))


def add_single_url():
    st.subheader(" Add Single Lead")
    col1, col2 = st.columns([3, 1])
    with col1:
        url = st.text_input("LinkedIn Profile URL", placeholder="https://www.linkedin.com/in/...")
    with col2:
        source = st.selectbox("Source", ["manual", "linkedin_search", "linkedin_search_mcp",
                                          "linkedin_connection_global", "initiative"], key="single_source")
    col3, col4 = st.columns([1, 3])
    with col3:
        if st.button("Add Lead", type="primary", use_container_width=True):
            if url and "linkedin.com/in/" in url:
                lead = build_lead_from_url(url, source=source)
                lead = enrich_lead(lead)
                st.session_state["pending_lead"] = lead
                st.rerun()
            else:
                st.error("Please enter a valid LinkedIn profile URL")

    with col4:
        if st.button("Clear", use_container_width=True):
            if "pending_lead" in st.session_state:
                del st.session_state["pending_lead"]
            st.rerun()

    if "pending_lead" in st.session_state:
        lead = st.session_state["pending_lead"]
        st.markdown("---")
        st.subheader("Edit Lead Details")
        with st.form("edit_lead_form"):
            c1, c2 = st.columns(2)
            with c1:
                full_name = st.text_input("Full Name", value=lead.full_name)
                title = st.text_input("Title", value=lead.title)
                company = st.text_input("Company / Institution", value=lead.company_institution)
                location = st.text_input("Location", value=lead.location)
                email = st.text_input("Email / Contact", value=lead.email_contact)
            with c2:
                profile_type = st.selectbox("Profile Type", PROFILE_TYPES,
                                            index=PROFILE_TYPES.index(lead.profile_type) if lead.profile_type in PROFILE_TYPES else 0)
                score = st.slider("Score", 0, 100, lead.score)
                revenue = st.number_input("Revenue Potential ($)", min_value=0, value=int(lead.revenue_potential) if lead.revenue_potential else 0, step=100)
                outreach_status = st.selectbox("Outreach Status", OUTREACH_STATUSES,
                                                index=OUTREACH_STATUSES.index(lead.outreach_status) if lead.outreach_status in OUTREACH_STATUSES else 0)

            pain_points = st.text_area("Pain Points", value=lead.pain_points_identified, height=80)
            value_prop = st.text_area("Value Proposition", value=lead.value_proposition, height=80)
            notes = st.text_area("Notes", value=lead.notes, height=60)

            submitted = st.form_submit_button(" Save to Excel", type="primary", use_container_width=True)
            if submitted:
                lead.full_name = full_name
                lead.title = title
                lead.company_institution = company
                lead.location = location
                lead.email_contact = email
                lead.profile_type = profile_type
                lead.score = score
                lead.revenue_potential = float(revenue)
                lead.outreach_status = outreach_status
                lead.pain_points_identified = pain_points
                lead.value_proposition = value_prop
                lead.notes = notes

                output = st.session_state.get("output_path", DEFAULT_OUTPUT)

                if not lead.outreach_message:
                    lead.outreach_message = generate_message(lead)

                n = append_leads(output, [lead])
                st.success(f"Saved to {output} ({n} lead added)")
                del st.session_state["pending_lead"]
                st.rerun()


def batch_import():
    st.subheader(" Batch Import")

    tab1, tab2, tab3 = st.tabs(["Paste URLs", "Upload Text File", "Sales Navigator CSV"])

    with tab1:
        urls_text = st.text_area(
            "Paste LinkedIn URLs (one per line)",
            height=150,
            placeholder="https://www.linkedin.com/in/username1/\nhttps://www.linkedin.com/in/username2/",
        )
        source = st.selectbox("Source", ["linkedin_search", "manual", "linkedin_search_mcp",
                                          "linkedin_connection_global"], key="batch_source")
        if st.button("Process URLs", type="primary", use_container_width=True):
            if urls_text.strip():
                urls = parse_urls_from_text(urls_text)
                if urls:
                    process_and_save(urls, source)
                else:
                    st.warning("No valid LinkedIn URLs found")
            else:
                st.warning("Paste some URLs first")

    with tab2:
        uploaded_file = st.file_uploader("Upload a text file with URLs", type=["txt"])
        source2 = st.selectbox("Source", ["linkedin_search", "manual", "linkedin_search_mcp",
                                           "linkedin_connection_global"], key="batch_source2")
        if uploaded_file and st.button("Process File", type="primary", use_container_width=True):
            text = uploaded_file.read().decode("utf-8")
            urls = parse_urls_from_text(text)
            if urls:
                process_and_save(urls, source2)
            else:
                st.warning("No valid LinkedIn URLs found in file")

    with tab3:
        csv_file = st.file_uploader("Upload Sales Navigator CSV export", type=["csv"])
        if csv_file and st.button("Import Sales Navigator CSV", type="primary", use_container_width=True):
            import tempfile
            with tempfile.NamedTemporaryFile(delete=False, suffix=".csv") as tmp:
                tmp.write(csv_file.getvalue())
                tmp_path = tmp.name
            try:
                leads = parse_sales_navigator_csv(tmp_path)
                for lead in leads:
                    enrich_lead(lead)
                output = st.session_state.get("output_path", DEFAULT_OUTPUT)
                n = append_leads(output, leads)
                st.success(f"Imported {n} leads from Sales Navigator to {output}")
            finally:
                Path(tmp_path).unlink(missing_ok=True)


def process_and_save(urls: List[str], source: str):
    leads = []
    progress = st.progress(0, text="Processing URLs...")
    for i, url in enumerate(urls):
        lead = build_lead_from_url(url, source=source)
        lead = enrich_lead(lead)
        leads.append(lead)
        progress.progress((i + 1) / len(urls), text=f"Processed {i+1}/{len(urls)}")

    output = st.session_state.get("output_path", DEFAULT_OUTPUT)
    n = append_leads(output, leads)
    st.success(f"Processed {len(urls)} URLs, added {n} new leads to {output}")

    st.subheader("Preview")
    df = pd.DataFrame([l.to_dict() for l in leads])
    st.dataframe(
        df[["full_name", "title", "company_institution", "location",
             "profile_type", "score", "outreach_status"]],
        use_container_width=True,
        hide_index=True,
    )


def view_database():
    st.subheader(" Lead Database")
    output = st.session_state.get("output_path", DEFAULT_OUTPUT)

    col1, col2 = st.columns([3, 1])
    with col1:
        st.caption(f"File: {output}")
    with col2:
        if st.button(" Refresh", use_container_width=True):
            st.rerun()

    try:
        df = read_leads(output)
    except Exception as e:
        st.info(f"No existing database at {output}. Add some leads first!")
        return

    if df.empty:
        st.info("No leads yet. Use the 'Add' or 'Batch Import' tabs to get started.")
        return

    total = len(df)
    converted = df["converted"].sum() if "converted" in df.columns else 0
    avg_score = df["score"].mean() if "score" in df.columns else 0

    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Total Leads", total)
    col2.metric("Converted", int(converted))
    col3.metric("Avg Score", f"{avg_score:.0f}")
    col4.metric("Pending Outreach", len(df[df["outreach_status"] == "pending"]) if "outreach_status" in df.columns else 0)

    st.markdown("### Filter & View")
    type_filter = st.multiselect("Filter by Profile Type",
                                  options=[t for t in df["profile_type"].unique() if t],
                                  default=[])
    if type_filter:
        df = df[df["profile_type"].isin(type_filter)]

    status_filter = st.multiselect("Filter by Outreach Status",
                                    options=[s for s in df["outreach_status"].unique() if s],
                                    default=[])
    if status_filter:
        df = df[df["outreach_status"].isin(status_filter)]

    display_cols = ["date_discovered", "full_name", "title", "company_institution",
                    "location", "profile_type", "score", "outreach_status", "converted", "revenue_potential"]

    st.dataframe(
        df[display_cols],
        use_container_width=True,
        hide_index=True,
        column_config={
            "converted": st.column_config.CheckboxColumn("Converted"),
            "score": st.column_config.NumberColumn("Score", format="%d"),
            "revenue_potential": st.column_config.NumberColumn("Revenue $", format="$%d"),
        }
    )

    st.markdown("###  Export / Download")
    col1, col2 = st.columns(2)
    with col1:
        if st.button("Save Copy As...", use_container_width=True):
            export_path = str(Path.home() / "Downloads" / f"naggar_leads_{date.today().isoformat()}.xlsx")
            write_leads(export_path, [Lead.from_dict(r) for _, r in df.iterrows()])
            st.success(f"Exported to {export_path}")

    with col2:
        csv = df.to_csv(index=False).encode("utf-8")
        st.download_button(
            "Download as CSV",
            data=csv,
            file_name=f"naggar_leads_{date.today().isoformat()}.csv",
            mime="text/csv",
            use_container_width=True,
        )


def auto_discover_tab():
    st.subheader(" Auto-Discover Leads from LinkedIn")

    st.info(
        ""
        "**How it works:**\n"
        "1. Logs into LinkedIn (your credentials, one-time)\n"
        "2. Searches for professors/researchers by keyword\n"
        "3. Collects what's visible on search result cards only\n"
        "4. **Does NOT** visit profiles (no one gets notified)\n"
        "5. **Does NOT** send connection requests or messages\n"
        "6. Saves to a separate file: **raw_leads.xlsx** for you to review\n\n"
        "You review the leads first, then manually choose who to contact."
    )

    with st.expander(" Step 1: Login to LinkedIn", expanded=True):
        st.markdown(
            "A browser window will open. **You log in manually** to LinkedIn.com "
            "— your password goes to LinkedIn, NOT to this tool. "
            "After logging in, come back here and the tool continues."
        )
        st.markdown("Cookies are saved so you only need to do this once.")

    with st.expander(" Step 2: Search Configuration", expanded=True):
        st.markdown("**Search queries** (edit as needed):")
        queries_text = st.text_area(
            "One query per line",
            value="\n".join(DEFAULT_SEARCHES),
            height=150,
            key="disc_queries",
        )
        col1, col2 = st.columns(2)
        with col1:
            max_per = st.slider("Max results per query", 5, 50, 20, key="disc_max")
        with col2:
            location = st.selectbox(
                "Location filter",
                ["", "Saudi Arabia", "UAE", "Egypt", "USA", "UK", "Germany", "Worldwide"],
                key="disc_location",
            )

    col1, col2 = st.columns([1, 3])
    with col1:
        run_btn = st.button(" Start Discovery (SAFE mode)", type="primary", use_container_width=True)
    with col2:
        status_placeholder = st.empty()

    if run_btn:
        queries = [q.strip() for q in queries_text.split("\n") if q.strip()]
        status_placeholder.info("Starting LinkedIn browser...")
        import asyncio

        RAW_OUTPUT = str(Path.home() / "Downloads" / "raw_leads.xlsx")

        async def run():
            scraper = LinkedInScraper()
            try:
                status_placeholder.info("Opening browser for login...")
                st.info("A browser window opened. Log in to LinkedIn manually, then return here.")
                ok = await scraper.ensure_logged_in()
                if not ok:
                    status_placeholder.error("Login failed")
                    return

                geo = LOCATION_FILTERS.get(location, "")
                progress_bar = st.progress(0, text="Searching...")
                all_results = []

                for i, query in enumerate(queries):
                    status_placeholder.info(f"Searching: {query}")
                    results = await scraper.search_people_safe(
                        query, max_results=max_per, location_geo=geo
                    )
                    all_results.extend(results)
                    progress_bar.progress(
                        (i + 1) / len(queries),
                        text=f"Query {i+1}/{len(queries)}: {len(results)} found",
                    )

                # Deduplicate
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
                        source="linkedin_auto_discovery",
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

                n = merge_leads(RAW_OUTPUT, leads)
                status_placeholder.success(f"Done! {len(unique)} profiles found, {n} new leads saved")
                st.info(f"**Saved to:** {RAW_OUTPUT}\n\nReview this file. No outreach was sent.")
                st.rerun()
            except Exception as e:
                status_placeholder.error(f"Error: {e}")
            finally:
                await scraper.close()

        asyncio.run(run())


def settings():
    st.subheader("⚙️ Settings")
    current = st.session_state.get("output_path", DEFAULT_OUTPUT)
    new_path = st.text_input("CRM Excel File Path", value=current)
    if new_path != current:
        st.session_state["output_path"] = new_path
        st.success(f"Output path updated to {new_path}")

    st.markdown("---")
    st.markdown("### Generate Outreach Message")
    col1, col2 = st.columns([3, 1])
    with col1:
        sample_url = st.text_input("Paste a LinkedIn URL to generate a message", key="msg_url")
    with col2:
        if st.button("Generate", use_container_width=True):
            if sample_url and "linkedin.com/in/" in sample_url:
                lead = build_lead_from_url(sample_url)
                enrich_lead(lead)
                msg = generate_message(lead)
                st.text_area("Generated Message", value=msg, height=250)
                st.caption(f"Template used: {lead.outreach_template_used}")
            else:
                st.warning("Enter a valid LinkedIn URL")

    st.markdown("---")
    st.markdown("### Strategy Reference")
    st.markdown("From **why_university_professors.html**:")
    cols = st.columns(3)
    segments = [
        ("A: Academic Researchers", "50,000+ TAM", "Primary — fastest path to revenue",
         "300 leads/month, 150 outreach, 15 responses"),
        ("B: Institutional Decision Makers", "500+ TAM", "Secondary — longest sales cycle",
         "80 leads/month, 20 outreach, 5 calls"),
        ("C: Ambassadors", "5,000+ TAM", "Enabling — unlocks Segment A",
         "20 leads/month, 10 calls, 5 signed"),
    ]
    for col, (name, tam, priority, target) in zip(cols, segments):
        with col:
            st.markdown(f"**{name}**")
            st.markdown(f"- TAM: {tam}")
            st.markdown(f"- {priority}")
            st.markdown(f"- Target: {target}")


def network_scan_tab():
    st.subheader(" Scan Your LinkedIn Network")

    st.info(
        ""
        "**How it works:**\n"
        "1. Enter your own LinkedIn profile URL\n"
        "2. The tool visits your connections page\n"
        "3. Scans your connections for potential leads\n"
        "4. Classifies each one and generates outreach messages\n"
        "5. **Does NOT** send any connection requests\n\n"
        "Use this to find hidden leads in your existing network."
    )

    col1, col2 = st.columns([3, 1])
    with col1:
        my_url = st.text_input(
            "Your LinkedIn Profile URL",
            placeholder="https://www.linkedin.com/in/your-profile/",
            key="network_url",
        )
    with col2:
        max_conn = st.number_input("Max connections", min_value=10, max_value=500, value=100, step=10, key="network_max")

    if st.button(" Scan My Network", type="primary", use_container_width=True):
        if not my_url or "linkedin.com/in/" not in my_url:
            st.error("Enter a valid LinkedIn profile URL")
            return

        import asyncio

        NETWORK_OUTPUT = str(Path.home() / "Downloads" / "network_leads.xlsx")
        status = st.empty()
        status.info("Opening browser for login...")

        async def run():
            from src.scraper import LinkedInScraper
            scraper = LinkedInScraper()
            try:
                st.info("A browser window opened. Log in to LinkedIn manually, then return here.")
                ok = await scraper.ensure_logged_in()
                if not ok:
                    status.error("Login failed")
                    return

                status.info("Scanning your connections...")
                progress = st.progress(0, text="Scanning...")
                n = await scraper.run_network_scan(my_url, max_connections=max_conn, output_file=NETWORK_OUTPUT)
                progress.progress(1.0)
                if n > 0:
                    status.success(f"Done! {n} leads saved to {NETWORK_OUTPUT}")
                else:
                    status.warning("No new leads found in your network")
            except Exception as e:
                status.error(f"Error: {e}")
            finally:
                await scraper.close()

        asyncio.run(run())


def main():
    header()
    sidebar_help()

    if "output_path" not in st.session_state:
        st.session_state["output_path"] = DEFAULT_OUTPUT

    tab1, tab2, tab3, tab4, tab5, tab6 = st.tabs([
        "➕ Add Single Lead",
        " Batch Import",
        " Auto Discover",
        " My Network",
        " View Database",
        "⚙️ Settings / Tools",
    ])

    with tab1:
        add_single_url()
    with tab2:
        batch_import()
    with tab3:
        auto_discover_tab()
    with tab4:
        network_scan_tab()
    with tab5:
        view_database()
    with tab6:
        settings()


if __name__ == "__main__":
    main()
