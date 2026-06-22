# Deploying CandleTunes to Google Cloud Run

A single container (built from the repo-root `Dockerfile`) runs the FastAPI backend,
which also serves the built React frontend as static files. Terraform provisions the
infrastructure and a single `terraform apply` also builds + pushes the image via
Cloud Build. The app is served on a custom domain with a Google-managed TLS cert.
With scale-to-zero, idle cost is ~$0.

## Prerequisites (one-time)

1. Install the [`gcloud` CLI](https://cloud.google.com/sdk/docs/install) and
   [Terraform](https://developer.hashicorp.com/terraform/install).
2. A GCP project with **billing enabled** (the always-free tier still applies).
3. Authenticate:
   ```bash
   gcloud auth login
   gcloud auth application-default login   # credentials Terraform uses
   ```
   > **Note:** if `GOOGLE_APPLICATION_CREDENTIALS` is set to a service-account key
   > for an unrelated project, the Google provider uses it *instead of* ADC. Unset
   > it in the shell you run Terraform from, e.g. (PowerShell):
   > `Remove-Item Env:GOOGLE_APPLICATION_CREDENTIALS`
4. **Verify the custom domain** for your account in
   [Search Console](https://search.google.com/search-console) — Cloud Run domain
   mappings require a verified domain or `terraform apply` will fail. To skip the
   domain and deploy on the `*.run.app` URL only, set `enable_domain_mapping = false`
   in `terraform.tfvars`.
5. **Create the Secret Manager secrets** (see below) — the Cloud Run revision mounts
   them at boot, so they must exist *before* `terraform apply` or the deploy fails.

## Secrets (one-time, out-of-band)

The app's API keys and Langfuse credentials are kept out of Terraform state, so the
secret **containers and their versions are created manually** with `gcloud`.
Terraform only grants the runtime service account accessor on them (`iam.tf`) and
references them from the Cloud Run env (`service.tf`). The secrets:

| Secret                 | Holds                                    | Required?                          |
| ---------------------- | ---------------------------------------- | ---------------------------------- |
| `anthropic-api-key`    | Anthropic API key (`sk-ant-…`)           | when `llm_provider = "anthropic"`  |
| `openai-api-key`       | OpenAI API key (`sk-…`)                  | when `llm_provider = "openai"`     |
| `langfuse-public-key`  | Langfuse public key (`pk-lf-…`)          | for LLM tracing (both keys needed) |
| `langfuse-secret-key`  | Langfuse secret key (`sk-lf-…`)          | for LLM tracing (both keys needed) |
| `google-client-secret` | OAuth 2.0 Web client secret (`GOCSPX-…`) | for Google sign-in (auth-code exchange) |

Create each secret **and add a version** with the real value. A secret with no
version causes a `versions/latest was not found` deploy error:

```bash
# Create the container, then add the value as a version. Repeat per secret.
gcloud secrets create langfuse-public-key --project=PROJECT_ID --replication-policy=automatic
echo -n "pk-lf-..." | gcloud secrets versions add langfuse-public-key --project=PROJECT_ID --data-file=-
```

> **PowerShell:** `echo -n` doesn't exist; pipe the string literal instead —
> `"pk-lf-..." | gcloud secrets versions add langfuse-public-key --project=PROJECT_ID --data-file=-`.
> Watch for trailing newlines if you pipe from a file: a stray `\r\n` in a key
> makes Langfuse basic-auth silently 401. Prefer a trimmed `--data-file=key.txt`.

Confirm each has an `enabled` version before applying:

```bash
gcloud secrets versions list langfuse-public-key --project=PROJECT_ID
```

Langfuse tracing auto-enables once both `langfuse-*` secrets resolve at runtime.

## Deploy

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars   # then edit project_id + domain
terraform init
terraform apply -var "image_tag=$(git rev-parse --short HEAD)"
```

`terraform apply` will:
1. Enable the `run`, `artifactregistry`, and `cloudbuild` APIs.
2. Create an Artifact Registry repo.
3. Build + push the image via Cloud Build.
4. Create the Cloud Run service (public, scales to zero) and the domain mapping.

Then add the DNS records from the output at your registrar:

```bash
terraform output domain_dns_records
```

The managed TLS cert provisions automatically once DNS propagates (~15–60 min).
The `service_url` output (`*.run.app`) works immediately for testing.

## Continuous deployment (GitHub Actions)

Pushes to `main` auto-deploy via `.github/workflows/deploy.yml`: it builds the
image and runs `gcloud run deploy`, authenticating to GCP **keylessly** through
Workload Identity Federation (no service-account key stored in GitHub).

The WIF pool/provider, the `candletunes-deploy` service account, and its IAM are
all provisioned by Terraform (`cicd.tf`). The workflow's `workload_identity_provider`
and `service_account` values come from these outputs:

```bash
terraform output workload_identity_provider
terraform output deploy_service_account
```

Because CI owns the running image, the Cloud Run service has
`ignore_changes = [..image]` — Terraform sets the bootstrap image and then leaves
image updates to the workflow, so the two don't fight.

## Redeploy (manual / Terraform)

CI handles deploys on push to `main`. To deploy manually (e.g. before the workflow
exists, or to change infra), bump the image tag and apply:

```bash
terraform apply -var "image_tag=$(git rev-parse --short HEAD)"
```

## Verify

```bash
curl "$(terraform output -raw service_url)/api/health"   # -> {"status":"ok"}
```

Then open the `service_url` (or your domain once DNS is live), add a ticker, and
confirm the chart + playback work.

## Tear down

```bash
terraform destroy
```

(APIs are left enabled to avoid disrupting other resources in the project.)

## Troubleshooting

- **`PERMISSION_DENIED` on the Cloud Build step during the first `apply`**: the
  Cloud Build API was just enabled and hasn't propagated yet. Wait ~30–60s and
  re-run `terraform apply` — it resumes at the build step.
- **Deploy fails with `Secret … not found` / `404` on a `langfuse-*` (or `*-api-key`)
  secret**: the secret container doesn't exist. Create it (see [Secrets](#secrets-one-time-out-of-band)).
- **Deploy fails with `Permission denied on secret … for Revision service account`**:
  the IAM accessor grant hasn't propagated to the revision yet (eventual consistency).
  The grant ordering is enforced via `depends_on` in `service.tf`, so just re-run
  `terraform apply`; wait ~1–2 min if it recurs.
- **Deploy fails with `secrets/…/versions/latest was not found`**: the secret exists
  but has no version. Add one with `gcloud secrets versions add …` (see Secrets).

## Notes

- The on-disk OHLCV cache writes to `/tmp/cache` (set via `CACHE_DIR`). It persists
  for a warm instance's lifetime and is lost on scale-to-zero — fine for hobby use.
- No CORS config is needed: the frontend is served from the same origin as the API
  and calls it with relative `/api/*` URLs.
- `terraform.tfvars` and Terraform state are gitignored — keep them out of version control.
