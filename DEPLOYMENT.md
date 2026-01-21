# Pantheon AI Platform - Deployment Guide

## 📋 Table of Contents

1. [Docker Hub Images](#docker-hub-images)
2. [Building Images](#building-images)
3. [Pushing to Docker Hub](#pushing-to-docker-hub)
4. [Deployment Options](#deployment-options)
5. [Production Deployment](#production-deployment)
6. [Cloud Deployment](#cloud-deployment)

---

## 🐳 Docker Hub Images

All Pantheon images are available on Docker Hub under the `akilhassane/pantheon` repository.

### Available Images

| Image | Tag | Size | Purpose |
|-------|-----|------|---------|
| `akilhassane/pantheon:frontend` | latest | 3.8GB | Next.js web application |
| `akilhassane/pantheon:backend` | latest | 431MB | Node.js API server |
| `akilhassane/pantheon:windows-tools-api` | latest | 1.2GB | Windows tools API |
| `akilhassane/pantheon:ubuntu-24` | latest | ~2GB | Ubuntu 24.04 desktop |
| `akilhassane/pantheon:kali-desktop` | latest | ~3GB | Kali Linux desktop |
| `akilhassane/pantheon:windows-11-25h2` | latest | 38.2GB | Windows 11 desktop |

### Pulling Images

```bash
# Pull all core images
docker pull akilhassane/pantheon:frontend
docker pull akilhassane/pantheon:backend
docker pull akilhassane/pantheon:windows-tools-api

# Pull OS images as needed
docker pull akilhassane/pantheon:ubuntu-24
docker pull akilhassane/pantheon:kali-desktop
docker pull akilhassane/pantheon:windows-11-25h2
```

---

## 🔨 Building Images

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- 100GB+ free disk space
- 16GB+ RAM

### Build All Images

```bash
# Clone repository
git clone https://github.com/akilhassane/pantheon.git
cd pantheon

# Build core services
docker-compose -f docker/docker-compose.yml build frontend backend windows-tools-api

# Build OS images
cd docker/ubuntu-24
docker build -t pantheon-ubuntu-24 .

cd ../kali
docker build -t pantheon-kali .

cd ../windows-11
docker build -f Dockerfile.snapshot-embedded -t pantheon-windows-11 .
```

### Build Individual Images

#### Frontend
```bash
docker build -f docker/Dockerfile.frontend -t pantheon-frontend .
```

#### Backend
```bash
docker build -f docker/Dockerfile.backend -t pantheon-backend .
```

#### Windows Tools API
```bash
cd docker/windows-tools-api
docker build -t pantheon-windows-tools-api .
```

#### Ubuntu 24
```bash
cd docker/ubuntu-24
docker build -t pantheon-ubuntu-24 .
```

#### Kali Linux
```bash
cd docker/kali
docker build -t pantheon-kali .
```

#### Windows 11
```bash
cd docker/windows-11
docker build -f Dockerfile.snapshot-embedded -t pantheon-windows-11 .
```

---

## 📤 Pushing to Docker Hub

### Login to Docker Hub

```bash
docker login
# Enter username: akilhassane7@gmail.com
# Enter password: outstanding
```

### Tag Images

```bash
# Tag core services
docker tag pantheon-frontend akilhassane/pantheon:frontend
docker tag pantheon-backend akilhassane/pantheon:backend
docker tag pantheon-windows-tools-api akilhassane/pantheon:windows-tools-api

# Tag OS images
docker tag pantheon-ubuntu-24 akilhassane/pantheon:ubuntu-24
docker tag pantheon-kali akilhassane/pantheon:kali-desktop
docker tag pantheon-windows-11 akilhassane/pantheon:windows-11-25h2
```

### Push Images

```bash
# Push core services
docker push akilhassane/pantheon:frontend
docker push akilhassane/pantheon:backend
docker push akilhassane/pantheon:windows-tools-api

# Push OS images
docker push akilhassane/pantheon:ubuntu-24
docker push akilhassane/pantheon:kali-desktop
docker push akilhassane/pantheon:windows-11-25h2
```

### Automated Push Script

Use the provided push script:

```bash
# Windows
.\push-to-pantheon.ps1

# Linux/macOS
./push-to-pantheon.sh
```

---

## 🚀 Deployment Options

### Option 1: Docker Compose (Recommended)

Best for: Single server deployments, development, testing

```bash
# Use production compose file
docker-compose -f docker-compose.production.yml up -d
```

### Option 2: Docker Swarm

Best for: Multi-node deployments, high availability

```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.production.yml pantheon
```

### Option 3: Kubernetes

Best for: Large-scale deployments, enterprise

```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/
```

### Option 4: Cloud Platforms

Best for: Managed infrastructure, scalability

- AWS ECS/EKS
- Google Cloud Run/GKE
- Azure Container Instances/AKS
- DigitalOcean App Platform

---

## 🏭 Production Deployment

### System Requirements

#### Minimum
- **CPU:** 4 cores
- **RAM:** 16GB
- **Disk:** 100GB SSD
- **Network:** 100 Mbps

#### Recommended
- **CPU:** 8+ cores
- **RAM:** 32GB+
- **Disk:** 500GB+ NVMe SSD
- **Network:** 1 Gbps

### Pre-Deployment Checklist

- [ ] Domain name configured
- [ ] SSL certificate obtained
- [ ] Firewall rules configured
- [ ] Backup strategy defined
- [ ] Monitoring setup
- [ ] Log aggregation configured
- [ ] Environment variables secured
- [ ] Database backups automated

### Deployment Steps

#### 1. Prepare Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create deployment directory
mkdir -p /opt/pantheon
cd /opt/pantheon
```

#### 2. Configure Environment

```bash
# Download production compose file
curl -O https://raw.githubusercontent.com/akilhassane/pantheon/main/docker-compose.production.yml

# Create .env file
cat > .env << EOF
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Public Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# AI Provider Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
OPENROUTER_API_KEY=sk-or-v1-...

# Security
MCP_MASTER_SECRET=$(openssl rand -hex 32)

# Server Configuration
NODE_ENV=production
DEBUG=false
EOF

# Secure .env file
chmod 600 .env
```

#### 3. Setup Reverse Proxy (Nginx)

```bash
# Install Nginx
sudo apt install nginx -y

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/pantheon
```

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name pantheon.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS configuration
server {
    listen 443 ssl http2;
    server_name pantheon.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/pantheon.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pantheon.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # File upload size limit
    client_max_body_size 100M;
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/pantheon /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

#### 4. Setup SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain certificate
sudo certbot --nginx -d pantheon.yourdomain.com

# Auto-renewal is configured automatically
```

#### 5. Deploy Application

```bash
# Pull images
docker-compose -f docker-compose.production.yml pull

# Start services
docker-compose -f docker-compose.production.yml up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

#### 6. Setup Monitoring

```bash
# Install monitoring tools
docker run -d \
  --name=prometheus \
  -p 9090:9090 \
  -v /opt/pantheon/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus

docker run -d \
  --name=grafana \
  -p 3001:3000 \
  grafana/grafana
```

#### 7. Configure Backups

```bash
# Create backup script
cat > /opt/pantheon/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/pantheon/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup volumes
docker run --rm \
  -v pantheon-data:/data \
  -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/data_$DATE.tar.gz -C /data .

# Backup database (Supabase)
# Use Supabase backup tools or pg_dump

# Cleanup old backups (keep last 7 days)
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

chmod +x /opt/pantheon/backup.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/pantheon/backup.sh") | crontab -
```

---

## ☁️ Cloud Deployment

### AWS Deployment

#### Using ECS (Elastic Container Service)

1. **Create ECR repositories:**
```bash
aws ecr create-repository --repository-name pantheon/frontend
aws ecr create-repository --repository-name pantheon/backend
aws ecr create-repository --repository-name pantheon/windows-tools-api
```

2. **Push images to ECR:**
```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Tag and push
docker tag akilhassane/pantheon:frontend <account-id>.dkr.ecr.us-east-1.amazonaws.com/pantheon/frontend:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/pantheon/frontend:latest
```

3. **Create ECS task definition:**
```json
{
  "family": "pantheon",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "2048",
  "memory": "4096",
  "containerDefinitions": [
    {
      "name": "frontend",
      "image": "<account-id>.dkr.ecr.us-east-1.amazonaws.com/pantheon/frontend:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NEXT_PUBLIC_SUPABASE_URL",
          "value": "https://your-project.supabase.co"
        }
      ]
    }
  ]
}
```

4. **Create ECS service:**
```bash
aws ecs create-service \
  --cluster pantheon-cluster \
  --service-name pantheon-service \
  --task-definition pantheon \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}"
```

### Google Cloud Deployment

#### Using Cloud Run

```bash
# Build and push to GCR
gcloud builds submit --tag gcr.io/PROJECT_ID/pantheon-frontend
gcloud builds submit --tag gcr.io/PROJECT_ID/pantheon-backend

# Deploy to Cloud Run
gcloud run deploy pantheon-frontend \
  --image gcr.io/PROJECT_ID/pantheon-frontend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated

gcloud run deploy pantheon-backend \
  --image gcr.io/PROJECT_ID/pantheon-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Azure Deployment

#### Using Container Instances

```bash
# Create resource group
az group create --name pantheon-rg --location eastus

# Create container group
az container create \
  --resource-group pantheon-rg \
  --name pantheon \
  --image akilhassane/pantheon:frontend \
  --dns-name-label pantheon-app \
  --ports 3000 \
  --environment-variables \
    NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
```

### DigitalOcean Deployment

#### Using App Platform

1. Connect GitHub repository
2. Configure build settings
3. Set environment variables
4. Deploy

---

## 🔒 Security Best Practices

### Environment Variables
- Use secrets management (AWS Secrets Manager, Azure Key Vault, etc.)
- Never commit `.env` files
- Rotate API keys regularly

### Network Security
- Use private networks for inter-service communication
- Configure firewall rules
- Enable DDoS protection
- Use VPN for administrative access

### Container Security
- Run containers as non-root user
- Use read-only filesystems where possible
- Scan images for vulnerabilities
- Keep images updated

### Application Security
- Enable HTTPS only
- Implement rate limiting
- Use strong authentication
- Enable audit logging
- Regular security updates

---

## 📊 Monitoring & Logging

### Metrics to Monitor
- CPU usage
- Memory usage
- Disk I/O
- Network traffic
- Request latency
- Error rates
- Container health

### Logging Strategy
- Centralized logging (ELK, Splunk, CloudWatch)
- Log rotation
- Log retention policy
- Structured logging
- Error tracking (Sentry)

### Alerting
- Set up alerts for:
  - High CPU/memory usage
  - Service downtime
  - Error rate spikes
  - Disk space low
  - SSL certificate expiration

---

## 🔄 Updates & Maintenance

### Updating Images

```bash
# Pull latest images
docker-compose pull

# Restart services with new images
docker-compose up -d

# Remove old images
docker image prune -a
```

### Database Migrations

```bash
# Run migrations
docker-compose exec backend node /app/backend/database/migrate.js
```

### Backup & Restore

```bash
# Backup
./backup.sh

# Restore
docker run --rm \
  -v pantheon-data:/data \
  -v /path/to/backup:/backup \
  alpine tar xzf /backup/data_20240101.tar.gz -C /data
```

---

## 📞 Support

For deployment assistance:
- **Email:** support@pantheon.ai
- **GitHub Issues:** https://github.com/akilhassane/pantheon/issues
- **Discord:** https://discord.gg/pantheon

---

**Last Updated:** January 2025
