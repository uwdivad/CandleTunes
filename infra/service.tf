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

      # Sensitive value: stored in Secret Manager, injected at runtime. The
      # secret + its version are created outside Terraform so the key never
      # enters state. The runtime SA is granted accessor in iam.tf.
      env {
        name = "ANTHROPIC_API_KEY"
        value_source {
          secret_key_ref {
            secret  = "anthropic-api-key"
            version = "latest"
          }
        }
      }

      env {
        name = "OPENAI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = "openai-api-key"
            version = "latest"
          }
        }
      }

      # Langfuse LLM observability. Both keys are credentials (public key is the
      # basic-auth username paired with the secret), so both live in Secret
      # Manager like the API keys above. Langfuse auto-enables once both are set.
      env {
        name = "LANGFUSE_PUBLIC_KEY"
        value_source {
          secret_key_ref {
            secret  = "langfuse-public-key"
            version = "latest"
          }
        }
      }

      env {
        name = "LANGFUSE_SECRET_KEY"
        value_source {
          secret_key_ref {
            secret  = "langfuse-secret-key"
            version = "latest"
          }
        }
      }

      # Non-secret config. Empty google_client_id disables auth (protected
      # endpoints then return 503); set it in terraform.tfvars to enable.
      env {
        name  = "LLM_PROVIDER"
        value = var.llm_provider
      }

      env {
        name  = "GOOGLE_CLIENT_ID"
        value = var.google_client_id
      }

      # Non-secret: which Langfuse instance to send traces to.
      env {
        name  = "LANGFUSE_HOST"
        value = var.langfuse_host
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
