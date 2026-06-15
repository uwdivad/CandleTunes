provider "google" {
  project = var.project_id
  region  = var.region
}

locals {
  # Artifact Registry image reference built by Cloud Build and run by Cloud Run.
  image = "${var.region}-docker.pkg.dev/${var.project_id}/${var.repo_id}/${var.service_name}:${var.image_tag}"
}
