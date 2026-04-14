variable "aws_region" {
  description = "AWS region to deploy to"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "featurevault"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.small"
}

variable "domain_name" {
  description = "Your root domain (must be in Route 53)"
  type        = string
  # e.g. "featurevault.yourdomain.com"
}

variable "github_repo" {
  description = "GitHub repo URL for initial clone"
  type        = string
  # e.g. "https://github.com/yourusername/featurevault"
}

variable "ssh_public_key" {
  description = "SSH public key content for EC2 access"
  type        = string
  sensitive   = true
}

variable "ssh_allowed_cidrs" {
  description = "CIDRs allowed to SSH. Restrict to your IP."
  type        = list(string)
  default     = ["0.0.0.0/0"]  # CHANGE THIS to your IP
}

variable "alarm_sns_arn" {
  description = "SNS topic ARN for CloudWatch alarms (optional)"
  type        = string
  default     = ""
}
