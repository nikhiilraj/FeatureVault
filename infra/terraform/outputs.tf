output "instance_ip" {
  description = "Elastic IP of the EC2 instance"
  value       = aws_eip.main.public_ip
}

output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.main.id
}

output "domain" {
  description = "Domain pointing to this instance"
  value       = var.domain_name
}

output "api_domain" {
  description = "API subdomain"
  value       = "api.${var.domain_name}"
}

output "ssh_command" {
  description = "SSH command to connect"
  value       = "ssh -i ~/.ssh/${var.project_name}.pem ec2-user@${aws_eip.main.public_ip}"
}
