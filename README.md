# AMCL Signal Monitoring

> An intelligence tool that scans public-sector documents for early signals that an
> organization may soon issue an RFP for asset management, investment advisory, or
> investment consulting services.

## Overview

Public-sector entities (transit authorities, county transportation boards, pension
systems, etc.) regularly publish board meeting minutes, agenda packets, and capital
budgets as PDFs. Buried in these documents are early signals of upcoming
procurement opportunities — contract expirations, new CIO/treasurer hires, asset
allocation studies, performance reviews, or explicit intent to solicit proposals.

This app automates the discovery of those signals. Given a priority sector, it
searches the web for recent, relevant public documents, extracts their text, and uses
an LLM to identify and score procurement signals — surfacing actionable leads that
would otherwise require hours of manual reading.

## The Problem It Solves

Manually monitoring hundreds of government board agendas for procurement signals is
slow, inconsistent, and easy to miss. This app turns that into a repeatable,
automated pipeline that returns structured, confidence-scored signals on demand.

## How It Works — The Pipeline

The core of the app is a linear pipeline where each stage hands its output to the next:

### Stage-by-Stage

| # | Stage | Function | Description |
|---|-------|----------|-------------|
| 1 | **Build Queries** | `buildQueries` | Takes a sector and generates several targeted query variants (board minutes, agenda packets, capital plans, etc.), each scoped to a **dynamic "past 1 month" recency window** computed at runtime. |
| 2 | **Search** | `searchYouCom` / `findDocuments` | Calls the You.com Search API (`https://ydc-index.io/v1/search`) for each query variant and collects web results (PDF documents). |
| 3 | **Filter** | `findDocuments` | Flattens results across queries, normalizes `http`→`https`, removes template/form sites (eForms, Jotform, etc.), and de-duplicates by URL. |
| 4 | **Extract** | `extractDocuments` | Downloads each PDF and extracts its text with `pdf-parse`. Handles failures gracefully and drops empty/scanned PDFs with no extractable text. |
| 5 | **Build Prompt** | `buildPrompt` | Assembles the extracted documents into a single analyst prompt instructing the LLM what signals to look for. |
| 6 | **Analyze** | `analyze` | Sends the prompt to the LLM, which returns candidate signals (title, verbatim quote, category, confidence, reasoning, timeframe) per document. |
| 7 | **Parse** | `parseResults` | Strips markdown code fences and parses the LLM output into structured JSON for the frontend. |

## Architecture

The app was originally built as an **n8n workflow** and has been migrated into a
self-contained **Next.js backend** for full control, easier debugging, and no
webhook/timeout friction.

Because the full pipeline takes several minutes (longer than a serverless HTTP
request allows), it runs asynchronously:

- **`app/api/signals/route.ts`** — thin trigger. Validates input, mints a `jobId`,
  fires the pipeline in the background via `after()`, and returns the `jobId`
  instantly.
- **`lib/runPipeline.ts`** — orchestrator. Chains the pipeline stages and writes the
  final results (or an error) to Redis under `job:{jobId}`.
- **`lib/pipeline.ts`** — the individual pipeline stages as pure, testable functions.
- **`app/api/status/[jobId]/route.ts`** — poll target. Reads job status/results
  from Redis.
- **Frontend** — submits a sector, polls until results are ready, and renders the
  signals in a table. 





