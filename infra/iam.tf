# Public app: allow unauthenticated invocations.
resource "google_cloud_run_v2_service_iam_member" "public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.app.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Let the Cloud Run runtime identity read the assistant's API key secrets.
# The secrets + versions are created out-of-band (see infra README / tfvars notes).
resource "google_secret_manager_secret_iam_member" "assistant_keys" {
  for_each  = toset(["anthropic-api-key", "openai-api-key"])
  project   = var.project_id
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.run.email}"
}
