# Fixes Applied to AI Backend

## Date: January 26, 2026

This document summarizes all fixes applied to ensure the AI Backend and shared folder containers work reliably.

## Issues Fixed

### 1. ✅ OpenRouter API "User not found" Error

**Problem**: Backend was using an invalid OpenRouter API key, causing 401 errors and preventing AI streaming.

**Solution**:
- Updated `OPENROUTER_API_KEY` in `.env` to valid key: `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`
- Updated `backend/.env` with the same key
- Rebuilt Docker image with correct environment variable
- Verified key validity with OpenRouter API

**Files Modified**:
- `.env`
- `backend/.env`
- `docker-compose.yml`

---

### 2. ✅ Shared Folder Container Failing to Start

**Problem**: Nginx container for Windows project shared folders was failing with exit code 127 and wouldn't restart after PC reboot.

**Root Causes**:
1. Invalid nginx configuration with `add_header` directives inside `if` blocks
2. Unsupported WebDAV directives in nginx:alpine
3. Files being created as directories instead of files

**Solution**:
- Fixed `windows-vm-files/nginx-shared-folder.conf`:
  - Removed `add_header` from `if` block (not allowed in nginx)
  - Removed WebDAV directives (not available in nginx:alpine)
  - Kept CORS headers at server level
- Created `docker/shared-folder-startup.sh` script
- Ensured files are created as files, not directories

**Files Created/Modified**:
- `windows-vm-files/nginx-shared-folder.conf` (fixed)
- `docker/shared-folder-startup.sh` (created)

---

### 3. ✅ Docker Host Path Mounting Issues

**Problem**: Backend couldn't create shared folder containers because it was using container paths instead of host paths for Docker bind mounts.

**Solution**:
- Set `HOST_WINDOWS_VM_FILES_PATH=/host/windows-vm-files` environment variable
- Updated docker-compose.yml to mount windows-vm-files to both:
  - `/host/windows-vm-files` (for Docker bind mounts)
  - `/app/windows-vm-files` (for backward compatibility)
- Backend now correctly uses host paths when creating new containers

**Files Modified**:
- `docker-compose.yml`
- `backend/project-manager.js` (already had the logic, just needed correct env var)

---

### 4. ✅ Windows MCP Connection Timeout

**Problem**: Backend couldn't connect to Windows MCP HTTP server at `host.docker.internal:10008`.

**Solution**:
- Added `extra_hosts` configuration to docker-compose.yml:
  ```yaml
  extra_hosts:
    - "host.docker.internal:host-gateway"
  ```
- This allows the container to properly resolve and connect to services on the Windows host

**Files Modified**:
- `docker-compose.yml`
- `docker-compose.production.yml`

---

### 5. ✅ Missing Docker Configuration Files

**Problem**: Backend Docker image didn't include necessary files for shared folder creation.

**Solution**:
- Updated `backend/Dockerfile` to:
  - Use root directory as build context
  - Copy `docker/` directory with startup scripts
  - Copy `windows-vm-files/nginx-shared-folder.conf` template
  - Install `wget` for health checks
  - Use custom entrypoint script
- Created `backend/docker-entrypoint.sh` for proper initialization
- Created `backend/.dockerignore` to exclude unnecessary files

**Files Created/Modified**:
- `backend/Dockerfile` (updated)
- `backend/docker-entrypoint.sh` (created)
- `backend/.dockerignore` (created)

---

### 6. ✅ Docker Compose Configuration

**Problem**: No proper docker-compose configuration for easy deployment and management.

**Solution**:
- Created `docker-compose.yml` with:
  - Proper service definition for ai-backend
  - All required environment variables
  - Correct volume mounts
  - Health check configuration
  - Network configuration
  - Restart policy (`unless-stopped`)

**Files Created**:
- `docker-compose.yml`

---

## New Files Created

1. **docker-compose.yml**: Main Docker Compose configuration
2. **backend/docker-entrypoint.sh**: Container startup script
3. **backend/.dockerignore**: Docker build exclusions
4. **docker/shared-folder-startup.sh**: Shared folder container startup
5. **windows-vm-files/nginx-shared-folder.conf**: Nginx configuration template
6. **DOCKER_SETUP.md**: Complete Docker setup documentation
7. **rebuild-backend.ps1**: PowerShell script to rebuild and restart
8. **FIXES_APPLIED.md**: This document

---

## Verification Steps

### 1. Check Backend Container
```bash
docker ps | grep ai-backend
# Should show: Up X seconds (healthy)
```

### 2. Check Health Endpoint
```bash
curl http://localhost:3002/health
# Should return: {"status":"ok","service":"kali-ai-backend"}
```

### 3. Check Shared Folder Container
```bash
docker ps | grep shared-folder
# Should show: Up X minutes
```

### 4. Check Logs
```bash
docker logs ai-backend --tail 20
# Should show no errors
```

### 5. Test OpenRouter API
- Send a message through the frontend
- Should stream response without "User not found" error

---

## Maintenance

### Rebuilding the Image
```bash
# Using PowerShell script
./rebuild-backend.ps1

# Or manually
docker-compose build ai-backend
docker-compose up -d ai-backend
```

### Viewing Logs
```bash
# Backend logs
docker logs -f ai-backend

# Shared folder logs
docker logs -f shared-folder-{projectId}
```

### Restarting After PC Reboot
Containers will automatically restart due to `unless-stopped` policy. No manual intervention needed.

---

## Environment Variables Reference

### Required in .env
```env
OPENROUTER_API_KEY=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
GEMINI_API_KEY=AIzaSyBFGT01BPlVpUNYUW_1Cwq7ZTqBARrdiwY
SUPABASE_URL=https://ekkrtmslvdypwilhdpgk.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
MCP_MASTER_SECRET=8d6fef27a042a6f458a9981967f3ead2d2cbcfe0a3cc2dd77045809a4f9cec56
```

### Set by Docker Compose
```env
HOST_WINDOWS_VM_FILES_PATH=/host/windows-vm-files
BACKEND_CONTAINER_NAME=ai-backend
PORT=3002
```

---

## Testing Checklist

- [x] Backend container starts successfully
- [x] Backend is healthy (health check passes)
- [x] OpenRouter API works (no "User not found" error)
- [x] Shared folder container starts successfully
- [x] Nginx serves files from shared folder
- [x] Containers restart after PC reboot
- [x] Windows MCP connection works (when MCP server is running)
- [x] Environment variables are set correctly
- [x] Docker volumes are mounted correctly

---

## Known Limitations

1. **Windows MCP Connection**: Requires Windows MCP HTTP server to be running in the Windows VM on port 8080 (mapped to host port 10008)
2. **Shared Folder Creation**: Only happens on backend startup or when explicitly triggered
3. **File Permissions**: Windows file permissions may cause issues with Docker mounts

---

## Future Improvements

1. Add automatic shared folder container recreation on failure
2. Implement health checks for shared folder containers
3. Add monitoring and alerting for container failures
4. Create automated tests for Docker setup
5. Add support for multiple backend instances (load balancing)

---

## Support

If issues persist:
1. Check all environment variables are set correctly
2. Verify Docker and Docker Compose versions
3. Check container logs for errors
4. Ensure all required files exist
5. Try rebuilding the image from scratch

For questions or issues, refer to `DOCKER_SETUP.md` for detailed documentation.
