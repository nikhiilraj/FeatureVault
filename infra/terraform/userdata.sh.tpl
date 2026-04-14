#!/bin/bash
set -euxo pipefail

# ── System updates ────────────────────────────────────────────
dnf update -y
dnf install -y git curl wget htop vim tmux

# ── Docker ───────────────────────────────────────────────────
dnf install -y docker
systemctl enable docker
systemctl start docker
usermod -aG docker ec2-user

# ── Docker Compose v2 ────────────────────────────────────────
mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# ── Nginx ────────────────────────────────────────────────────
dnf install -y nginx
systemctl enable nginx

# ── Certbot (Let's Encrypt) ──────────────────────────────────
dnf install -y python3-certbot-nginx

# ── CloudWatch Agent ─────────────────────────────────────────
dnf install -y amazon-cloudwatch-agent

# ── Node.js 20 (for any local scripts) ───────────────────────
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
dnf install -y nodejs

# ── Swap space (important for t3.small) ──────────────────────
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile swap swap defaults 0 0' >> /etc/fstab

# ── Clone the repo ────────────────────────────────────────────
cd /home/ec2-user
git clone ${github_repo} featurevault
chown -R ec2-user:ec2-user featurevault

# ── Set up log rotation for Docker ───────────────────────────
cat > /etc/docker/daemon.json << 'DOCKEREOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
DOCKEREOF
systemctl restart docker

echo "Bootstrap complete — $(date)" > /home/ec2-user/bootstrap.log
