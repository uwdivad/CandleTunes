"""Diagnose why Langfuse traces aren't appearing. Reads the same config the app
does (env vars / backend/.env via app.config), checks auth, and emits one real
test trace so you can confirm end-to-end ingestion.

Run with the SAME credentials the deployed service uses. Pull them into your
shell so they're never pasted into a prompt, e.g. (PowerShell):

    $env:LANGFUSE_PUBLIC_KEY = (gcloud secrets versions access latest --secret=langfuse-public-key --project=candletunes)
    $env:LANGFUSE_SECRET_KEY = (gcloud secrets versions access latest --secret=langfuse-secret-key --project=candletunes)
    $env:LANGFUSE_BASE_URL = "https://us.cloud.langfuse.com"
    .venv\\Scripts\\python.exe -m scripts.langfuse_smoke

NOTE: a shell `(...)` capture trims the trailing newline, so this masks the
"trailing newline in the secret" failure mode that Cloud Run's raw secret
injection does NOT trim. The byte-length line below helps you spot that: a
Langfuse public key is `pk-lf-<uuid>` (typically 44 chars); a secret key is
`sk-lf-<uuid>`. Lengths longer than expected (or a non-`pk-lf-`/`sk-lf-` prefix)
point at stray whitespace.
"""

from app.config import settings
from app.observability import generation, get_langfuse, trace_span


def main() -> int:
    pk = settings.langfuse_public_key
    sk = settings.langfuse_secret_key
    print(f"langfuse_enabled : {settings.langfuse_enabled}")
    print(f"host             : {settings.langfuse_base_url}")
    # Public key is not a secret; print enough to confirm which project/region.
    print(f"public_key       : prefix={pk[:8]!r} len={len(pk)}")
    print(f"secret_key       : prefix={sk[:6]!r} len={len(sk)}  (value not shown)")

    if not settings.langfuse_enabled:
        print("\n=> Disabled: both LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY must be set.")
        return 1

    lf = get_langfuse()
    # auth_check() does a live authenticated request; it surfaces a 401 from a
    # bad/whitespace-corrupted key that the app would otherwise drop silently.
    try:
        ok = lf.auth_check()
        print(f"\nauth_check()     : {ok}")
        if not ok:
            print("=> Credentials rejected (401). Re-check the keys/host and any trailing whitespace.")
            return 1
    except Exception as exc:  # noqa: BLE001
        print(f"\nauth_check() raised: {exc!r}")
        return 1

    with trace_span(
        "langfuse_smoke",
        input={"note": "smoke test from scripts/langfuse_smoke.py"},
        tags=["smoke-test"],
    ) as span:
        with generation(name="smoke.generation", model="diagnostic", input="ping") as gen:
            gen.update(output="pong", usage_details={"input": 1, "output": 1})
        if span:
            span.update(output="ok")

    print("\n=> Sent one trace named 'langfuse_smoke' and flushed.")
    print("   Open Langfuse and confirm the PROJECT matches the public_key prefix above,")
    print("   then look in Traces (clear any date/env filters). If it's here but your")
    print("   app traces aren't, the app and this script are using different projects.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
