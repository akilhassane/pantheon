# Deployment Guide

Deploy Pantheon AI Platform to production.

## Table of Contents

- [Deployment Options](#deployment-options)
- [Docker Deployment](#docker-deployment)
- [Cloud Deployment](#cloud-deployment)
- [Configuration](#configuration)
- [Monitoring](#monitoring)
- [Maintenance](#maintenance)

## Deployment Options

### 1. Docker Compose (Recommended for Small Teams)
- Easy setup
- Single server deployment
- Good for 1-50 users

### 2. Docker Swarm (Medium Scale)
- Multi-server deployment
- Load balancing
- Good for 50-500 users

### 3. Kubernetes (Enterprise Scale)
- Highly scalable
- Auto-scaling
- Good for 500+ users

## Docker Deployment

### Prerequisites

- Linux server (Ubuntu 20.04+ recommended)
- 16GB+ RAM
- 100GB+ disk space
- Docker 20.10+
- Docker Compose 2.0+
- Domain name (optional)

### Step 1: Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

### Step 2: Clone Repository

```bash
# Clone repository
git clone https://github.com/akilhassane/pantheon.git
cd pantheon
```

### Step 3: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

Production environment variables:
```env
# Application
NODE_ENV=production
FRONTEND_PORT=3000
BACKEND_PORT=3002

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...

# Security
SESSION_SECRET=generate-random-secret-here
JWT_SECRET=generate-random-secret-here

# Logging
LOG_LEVEL=info
```

### Step 4: Deploy

```bash
# Pull images
docker-compose -f docker-compose.production.yml pull

# Start services
docker-compose -f docker-compose.production.yml up -d

# View logs
docker-compose -f docker-compose.production.yml logs -f
```

### Step 5: Verify Deployment

```bash
# Check services
docker ps

# Test health endpoint
curl http://localhost:3002/health

# Access application
# Open http://your-server-ip:3000
```

## Cloud Deployment

### AWS Deployment

#### Using EC2

1. **Launch EC2 Instance**
   - AMI: Ubuntu 20.04
   - Instance Type: t3.xlarge (4 vCPU, 16GB RAM)
   - Storage: 100GB SSD
   - Security Group: Allow ports 22, 80, 443, 3000, 3002

2. **Connect and Deploy**
```bash
# SSH to instance
ssh -i your-key.pem ubuntu@your-instance-ip

# Follow Docker Deployment steps above
```

3. **Configure Domain (Optional)**
```bash
# Install Nginx
sudo apt install nginx -y

# Configure reverse proxy
sudo nano /etc/nginx/sites-available/pantheon
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/pantheon /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Install SSL certificate
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

#### Using ECS (Elastic Container Service)

1. **Create ECS Cluster**
2. **Create Task Definitions**
3. **Create Services**
4. **Configure Load Balancer**

### Google Cloud Platform

#### Using Compute Engine

Similar to AWS EC2 deployment.

#### Using Cloud Run

```bash
# Build and push images
docker build -t gcr.io/your-project/pantheon-frontend:latest ./frontend
docker build -t gcr.io/your-project/pantheon-backend:latest ./backend

docker push gcr.io/your-project/pantheon-frontend:latest
docker push gcr.io/your-project/pantheon-backend:latest

# Deploy to Cloud Run
gcloud run deploy pantheon-frontend \
  --image gcr.io/your-project/pantheon-frontend:latest \
  --platform managed \
  --region us-central1

gcloud run deploy pantheon-backend \
  --image gcr.io/your-project/pantheon-backend:latest \
  --platform managed \
  --region us-central1
```

### DigitalOcean

#### Using Droplets

1. **Create Droplet**
   - Image: Ubuntu 20.04
   - Plan: 4GB RAM, 2 vCPUs
   - Add SSH key

2. **Deploy**
```bash
# SSH to droplet
ssh root@your-droplet-ip

# Follow Docker Deployment steps
```

#### Using App Platform

```yaml
# app.yaml
name: pantheon
services:
  - name: frontend
    github:
      repo: akilhassane/pantheon
      branch: main
      deploy_on_push: true
    build_command: cd frontend && npm install && npm run build
    run_command: cd frontend && npm start
    envs:
      - key: NODE_ENV
        value: production
    
  - name: backend
    github:
      repo: akilhassane/pantheon
      branch: main
      deploy_on_push: true
    build_command: cd backend && npm install
    run_command: cd backend && npm start
    envs:
      - key: NODE_ENV
        value: production
```

## Configuration

### Environment Variables

```env
# Required
NODE_ENV=production
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
OPENAI_API_KEY=...

# Optional
FRONTEND_PORT=3000
BACKEND_PORT=3002
LOG_LEVEL=info
MAX_PROJECTS_PER_USER=10
SESSION_TIMEOUT=3600000
```

### Docker Compose Configuration

```yaml
# docker-compose.production.yml
version: '3.8'

services:
  frontend:
    image: akilhassane/pantheon-frontend:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    restart: always
    
  backend:
    image: akilhassane/pantheon-backend:latest
    ports:
      - "3002:3002"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    restart: always
    depends_on:
      - frontend
```

### Resource Limits

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
```

## Monitoring

### Health Checks

```bash
# Backend health
curl http://localhost:3002/health

# Expected response
{"status":"ok","timestamp":"2025-01-25T10:00:00Z"}
```

### Logging

```bash
# View logs
docker-compose -f docker-compose.production.yml logs -f

# View specific service logs
docker-compose -f docker-compose.production.yml logs -f backend

# Export logs
docker-compose -f docker-compose.production.yml logs > pantheon.log
```

### Monitoring Tools

#### Prometheus + Grafana

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    
  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

#### Uptime Monitoring

Use services like:
- UptimeRobot
- Pingdom
- StatusCake

## Maintenance

### Backup

```bash
# Backup database
# Supabase handles automatic backups

# Backup volumes
docker run --rm \
  -v pantheon_data:/data \
  -v $(pwd):/backup \
  ubuntu tar czf /backup/pantheon-backup.tar.gz /data

# Backup environment
cp .env .env.backup
```

### Updates

```bash
# Pull latest images
docker-compose -f docker-compose.production.yml pull

# Restart services
docker-compose -f docker-compose.production.yml up -d

# Clean up old images
docker image prune -a
```

### Scaling

#### Horizontal Scaling

```yaml
# docker-compose.production.yml
services:
  backend:
    deploy:
      replicas: 3
```

#### Load Balancer

```nginx
upstream backend {
    server backend1:3002;
    server backend2:3002;
    server backend3:3002;
}

server {
    location /api {
        proxy_pass http://backend;
    }
}
```

### Security

#### Firewall

```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

#### SSL Certificate

```bash
# Let's Encrypt
sudo certbot --nginx -d your-domain.com
```

#### Security Headers

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker-compose -f docker-compose.production.yml logs

# Check resources
docker stats

# Restart services
docker-compose -f docker-compose.production.yml restart
```

### High Memory Usage

```bash
# Check memory
free -h

# Limit container memory
docker update --memory 2g <container_id>
```

### Database Connection Issues

```bash
# Test Supabase connection
curl https://your-project.supabase.co/rest/v1/

# Check environment variables
docker-compose -f docker-compose.production.yml config
```

## Next Steps

- [Monitoring Guide](./MONITORING.md) - Set up monitoring (coming soon)
- [Security Guide](./SECURITY.md) - Security best practices (coming soon)
- [Troubleshooting](./TROUBLESHOOTING.md) - Common issues

---

[← Back to README](../README.md)
