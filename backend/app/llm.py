"""LLM client and prompt logic for event analysis."""

import json
from typing import AsyncIterator
from openai import AsyncOpenAI
from .config import LLM_BASE_URL, LLM_MODEL, LLM_API_KEY

_client: AsyncOpenAI | None = None


def get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(base_url=LLM_BASE_URL, api_key=LLM_API_KEY)
    return _client


def build_prompt(project_name: str, description: str | None, events: list[dict]) -> str:
    recent = events[:50]  # cap context size

    # Summarise numeric fields across events
    field_values: dict[str, list[float]] = {}
    sources: set[str] = set()
    for e in recent:
        if e.get("source"):
            sources.add(e["source"])
        for k, v in (e.get("numeric_fields") or {}).items():
            field_values.setdefault(k, []).append(v)

    field_summary_lines = []
    for field, values in sorted(field_values.items()):
        mn, mx, avg = min(values), max(values), sum(values) / len(values)
        field_summary_lines.append(
            f"  - {field}: min={mn:.2f}, max={mx:.2f}, avg={avg:.2f}, n={len(values)}"
        )

    # Sample payloads (first 5, stripped of numeric fields for brevity)
    sample_payloads = []
    for e in recent[:5]:
        payload = {k: v for k, v in e["payload"].items() if not isinstance(v, (int, float))}
        payload.update({k: v for k, v in e["payload"].items() if isinstance(v, (int, float))})
        sample_payloads.append(json.dumps(e["payload"], indent=2))

    samples_text = "\n---\n".join(sample_payloads)

    numeric_text = "\n".join(field_summary_lines) if field_summary_lines else "  (none detected)"
    sources_text = ", ".join(sorted(sources)) if sources else "(unknown)"

    return f"""You are an expert observability analyst. You are analysing telemetry events collected by a monitoring tool called compen.

Project: {project_name}
Description: {description or "Not provided"}
Total events analysed: {len(recent)}
Sources: {sources_text}

Numeric field statistics across all events:
{numeric_text}

Sample event payloads (up to 5):
{samples_text}

Please provide a concise, insightful analysis structured as follows:

## Summary
One or two sentences describing what this data represents and its overall health.

## Key Observations
Bullet points covering notable patterns, trends, or behaviours you can detect from the numeric stats and payload samples.

## Anomalies & Concerns
Any values, patterns, or combinations that look unusual, unhealthy, or worth investigating. If nothing stands out, say so.

## Recommendations
Actionable suggestions based on what you see. Be specific to the data — avoid generic advice.

Keep your response concise and focused on what the data actually shows. Do not speculate beyond what the events reveal."""


async def stream_analysis(project_name: str, description: str | None, events: list[dict]) -> AsyncIterator[str]:
    """Stream the LLM analysis token by token."""
    prompt = build_prompt(project_name, description, events)
    client = get_client()

    stream = await client.chat.completions.create(
        model=LLM_MODEL,
        messages=[{"role": "user", "content": prompt}],
        stream=True,
        temperature=0.3,
        max_tokens=1024,
    )

    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta
