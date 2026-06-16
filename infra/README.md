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
   mappings require a verified domain or `terraform apply` will fail.

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

## Redeploy

Bump the image to a fresh tag and apply again:

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

## Notes

- The on-disk OHLCV cache writes to `/tmp/cache` (set via `CACHE_DIR`). It persists
  for a warm instance's lifetime and is lost on scale-to-zero — fine for hobby use.
- No CORS config is needed: the frontend is served from the same origin as the API
  and calls it with relative `/api/*` URLs.
- `terraform.tfvars` and Terraform state are gitignored — keep them out of version control.
