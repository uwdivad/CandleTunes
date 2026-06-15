# Build the image from the repo-root Dockerfile via Cloud Build and push it to
# Artifact Registry. Re-runs whenever image_tag changes (pass a new git SHA).
resource "null_resource" "build_push" {
  triggers = {
    image_tag = var.image_tag
  }

  provisioner "local-exec" {
    working_dir = "${path.module}/.."
    command     = "gcloud builds submit --project ${var.project_id} --tag ${local.image} ."
  }

  depends_on = [
    google_artifact_registry_repository.repo,
    google_project_service.apis,
  ]
}
