# Map the custom domain to the service. Google provisions a managed TLS cert
# automatically once the DNS records (see outputs) are in place.
#
# Prerequisite: the domain must be verified for the deploying account in
# Search Console / Webmaster Central, or applying this will fail.
resource "google_cloud_run_domain_mapping" "domain" {
  location = var.region
  name     = var.domain

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.app.name
  }
}
