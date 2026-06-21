"""Register custom model prices in your (self-hosted) Langfuse so it can compute
the cost of assistant runs.

Langfuse derives cost from a generation's `model` name + token usage by matching
the name against a model definition's `matchPattern`. Well-known OpenAI models
(e.g. gpt-4.1) ship in Langfuse's built-in price list, but newer Anthropic IDs
like claude-opus-4-8 do not — register them here once per Langfuse project.

Run against a configured backend (reads keys from backend/.env via app.config):

    .venv\\Scripts\\python.exe -m scripts.register_langfuse_models

Idempotent-ish: Langfuse keeps model definitions versioned, so re-running adds a
new definition that shadows the old one for future generations. Prices are
per-token (USD). Update them if Anthropic's pricing changes.
"""

import sys

import httpx

from app.config import settings

# Per-token USD prices. claude-opus-4-8: $5 / 1M input, $25 / 1M output.
MODELS = [
    {
        "modelName": "claude-opus-4-8",
        "matchPattern": "(?i)^claude-opus-4-8$",
        "unit": "TOKENS",
        "inputPrice": 0.000005,
        "outputPrice": 0.000025,
    },
]


def main() -> int:
    if not settings.langfuse_enabled:
        print("Langfuse not configured (set langfuse_public_key/secret_key).", file=sys.stderr)
        return 1

    url = settings.langfuse_host.rstrip("/") + "/api/public/models"
    auth = (settings.langfuse_public_key, settings.langfuse_secret_key)

    for model in MODELS:
        resp = httpx.post(url, json=model, auth=auth, timeout=30)
        if resp.is_success:
            print(f"Registered {model['modelName']}: "
                  f"${model['inputPrice'] * 1_000_000:g}/1M in, "
                  f"${model['outputPrice'] * 1_000_000:g}/1M out")
        else:
            print(f"FAILED {model['modelName']}: {resp.status_code} {resp.text}", file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
