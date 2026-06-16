# Dedicated runtime identity. No extra IAM roles needed — the app only makes
# outbound HTTPS calls (Yahoo Finance) and uses no other GCP services.
resource "google_service_account" "run" {
  project      = var.project_id
  account_id   = "${var.service_name}-run"
  display_name = "CandleTunes Cloud Run runtime"
}

resource "google_cloud_run_v2_service" "app" {
  project             = var.project_id
  name                = var.service_name
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    service_account = google_service_account.run.email

    scaling {
      min_instance_count = 0
      max_instance_count = var.max_instances
    }

    containers {
      image = local.image

      ports {
        container_port = 8080
      }

      env {
        name  = "CACHE_DIR"
        value = "/tmp/cache"
      }

      resources {
        limits = {
          cpu    = "1"
          memory = var.memory
        }
      }
    }
  }

  depends_on = [null_resource.build_push]

  # The image is set on the initial (bootstrap) deploy, then owned by the GitHub
  # Actions workflow (`gcloud run deploy`). Ignore drift so CI and Terraform
  # don't fight over the running revision's image.
  lifecycle {
    ignore_changes = [template[0].containers[0].image]
  }
}
