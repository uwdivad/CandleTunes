output "service_url" {
  description = "Auto-generated Cloud Run URL (works immediately, before DNS propagates)."
  value       = google_cloud_run_v2_service.app.uri
}

output "domain_dns_records" {
  description = "DNS records to add at your registrar to point the custom domain at the service."
  value       = google_cloud_run_domain_mapping.domain.status[0].resource_records
}
