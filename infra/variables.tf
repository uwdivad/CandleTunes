variable "project_id" {
  type        = string
  description = "GCP project ID to deploy into (billing must be enabled)."
}

variable "region" {
  type        = string
  description = "Cloud Run region. Must support Cloud Run domain mappings."
  default     = "us-central1"
}

variable "service_name" {
  type        = string
  description = "Cloud Run service name (also used as the image name)."
  default     = "candletunes"
}

variable "repo_id" {
  type        = string
  description = "Artifact Registry repository ID for the container image."
  default     = "candletunes"
}

variable "domain" {
  type        = string
  description = "Custom domain to map to the service (must be verified for the deploying account). Ignored when enable_domain_mapping is false."
  default     = ""
}

variable "enable_domain_mapping" {
  type        = bool
  description = "Whether to create the custom-domain mapping. Set false to deploy on the *.run.app URL only."
  default     = true
}

variable "github_repo" {
  type        = string
  description = "GitHub repo (owner/name) allowed to deploy via Workload Identity Federation."
  default     = "uwdivad/CandleTunes"
}

variable "image_tag" {
  type        = string
  description = "Container image tag. Pass the git short SHA so each deploy is a new immutable tag."
  default     = "latest"
}

variable "memory" {
  type        = string
  description = "Memory limit per container instance."
  default     = "512Mi"
}

variable "max_instances" {
  type        = number
  description = "Maximum number of container instances (scales down to 0 when idle)."
  default     = 2
}

variable "llm_provider" {
  type        = string
  description = "Default LLM provider for the arranger assistant (\"anthropic\" or \"openai\"). Per-request overridable."
  default     = "anthropic"
}

variable "google_client_id" {
  type        = string
  description = "Google OAuth 2.0 Web client ID used as the ID-token audience. Empty disables auth (protected endpoints return 503)."
  default     = ""
}

variable "langfuse_host" {
  type        = string
  description = "Langfuse instance the service sends LLM traces to. Tracing only activates when the langfuse-public-key/langfuse-secret-key secrets also exist."
  default     = "https://us.cloud.langfuse.com"
}
