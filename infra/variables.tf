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
  description = "Custom domain to map to the service (must be verified for the deploying account)."
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
