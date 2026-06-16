output "service_url" {
  description = "Auto-generated Cloud Run URL (works immediately, before DNS propagates)."
  value       = google_cloud_run_v2_service.app.uri
}

output "domain_dns_records" {
  description = "DNS records to add at your registrar to point the custom domain at the service (null when the mapping is disabled)."
  value       = var.enable_domain_mapping ? google_cloud_run_domain_mapping.domain[0].status[0].resource_records : null
}

output "workload_identity_provider" {
  description = "Full resource name of the WIF provider — set as workload_identity_provider in the GitHub Actions workflow."
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "deploy_service_account" {
  description = "Email of the deploy SA the workflow impersonates."
  value       = google_service_account.deploy.email
}
