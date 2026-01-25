# Pantheon on Vercel 🚀

This guide covers deploying Pantheon to Vercel with a hybrid architecture:
- **Frontend + Backend**: Vercel (serverless)
- **Containers**: Client machines (via agents)

## Why Vercel?

✅ **Pros:**
- Free tier available
- Automatic HTTPS
- Global CDN
- Easy deployment
- Great for Next.js
- Built-in analytics

⚠️ **Limitations:**
- No Docker support (solved with client agents)
- Limited WebSocket support (use SSE or external service)
- Serverless timeout limits (10s hobby, 60s pro)

## Quick Start

### 1. Prerequisites
```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login
```

### 2. Deploy Frontend
```bash
cd frontend
vercel --prod
```

### 3. Deploy Backend
```bash
cd backend
vercel --prod
```

### 4. Configure Environment Variables

Go to Vercel dashboard and add variables for both projects.

**Frontend variables:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL` (your backend URL)

**Backend variables:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- `CONTAINER_MODE=remote`

### 5. Deploy Client Agents

On each client machine:
```bash
cd client-agent
npm install
cp .env.example .env
# Edit .env with backend URL
npm start
```

## Architecture

```
Vercel Cloud
├── Frontend (Next.js)
│   └── https://pantheon-frontend.vercel.app
└── Backend (Serverless Functions)
    └── https://pantheon-backend.vercel.app
        │
        └── SSE/API ──┐
                      │
        ┌─────────────┴─────────────┐
        │                           │
    Client 1                    Client 2
    (Agent + Docker)            (Agent + Docker)
```

## Files Added for Vercel

- `frontend/vercel.json` - Frontend config
- `backend/vercel.json` - Backend config
- `backend/api/index.js` - Serverless entry point
- `backend/api/agent-stream.js` - SSE for client agents
- `docs/VERCEL_DEPLOYMENT.md` - Full deployment guide
- `VERCEL_QUICK_START.md` - Quick reference

## WebSocket Alternative

Since Vercel has limited WebSocket support, we use **Server-Sent Events (SSE)**:

**Client Agent connects via SSE:**
```javascript
const eventSource = new EventSource(
  'https://pantheon-backend.vercel.app/api/agent-stream?clientId=xxx',
  { headers: { 'Authorization': 'Bearer YOUR_KEY' } }
);

eventSource.onmessage = (event) => {
  const command = JSON.parse(event.data);
  // Execute command
};
```

**Client sends results via POST:**
```javascript
fetch('https://pantheon-backend.vercel.app/api/agent-result', {
  method: 'POST',
  body: JSON.stringify({ commandId, result })
});
```

## Cost Breakdown

### Vercel Hobby (Free)
- 100GB bandwidth/month
- 100 hours serverless execution
- Good for: Testing, small projects

### Vercel Pro ($20/month)
- 1TB bandwidth
- 1000 hours execution
- Custom domains
- Better performance
- Good for: Production

### Total Monthly Cost
- Vercel: $0-20
- Supabase: $0 (free tier)
- AI APIs: Variable
- **Total: $0-20/month** + AI costs

## Deployment Scripts

### Automated Deployment

**Linux/Mac:**
```bash
chmod +x deploy-vercel.sh
./deploy-vercel.sh
```

**Windows:**
```powershell
.\deploy-vercel.ps1
```

### Manual Deployment

```bash
# Deploy both at once
vercel --prod --cwd frontend &
vercel --prod --cwd backend &
wait
```

## Monitoring

### View Logs
```bash
# Frontend logs
vercel logs pantheon-frontend

# Backend logs
vercel logs pantheon-backend
```

### Dashboard
- Go to [vercel.com/dashboard](https://vercel.com/dashboard)
- Select project
- View deployments, logs, analytics

## Troubleshooting

### Build Errors

**Issue**: TypeScript errors during build
**Solution**: Already configured to ignore in `next.config.js`

**Issue**: Missing dependencies
**Solution**: Check `package.json` and run `npm install`

### Runtime Errors

**Issue**: Environment variables not found
**Solution**: Set in Vercel dashboard, then redeploy

**Issue**: Supabase connection fails
**Solution**: Verify credentials and check Supabase logs

**Issue**: API timeout
**Solution**: 
- Upgrade to Pro for 60s timeout
- Use streaming for long operations
- Implement job queue for background tasks

### Client Agent Issues

**Issue**: Can't connect to backend
**Solution**: 
- Use `https://` (not `http://`)
- Verify API key
- Check firewall settings

**Issue**: Commands not executing
**Solution**:
- Check Docker is running
- Verify agent logs
- Test Docker commands manually

## Production Checklist

- [ ] Frontend deployed and accessible
- [ ] Backend deployed and accessible
- [ ] All environment variables set
- [ ] Supabase database configured
- [ ] Custom domain configured (optional)
- [ ] SSL certificates active (automatic)
- [ ] Client agents deployed
- [ ] SSE/API communication working
- [ ] Error tracking enabled
- [ ] Monitoring configured

## Advanced Configuration

### Custom Domains

1. Add domain in Vercel dashboard
2. Update DNS records
3. Update environment variables
4. Redeploy

### CI/CD

Vercel automatically deploys on git push:
- `main` branch → Production
- Other branches → Preview deployments

### Edge Functions

For better performance, use Vercel Edge Functions:
```javascript
// backend/api/edge-function.js
export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  return new Response('Hello from Edge!');
}
```

## Alternative: Hybrid Deployment

If Vercel limitations are too restrictive:

- **Frontend**: Vercel ✅
- **Backend**: Railway/Render (better WebSocket support)
- **Database**: Supabase ✅
- **Containers**: Client agents ✅

This gives you the best of both worlds!

## Documentation

- 📖 [Full Deployment Guide](docs/VERCEL_DEPLOYMENT.md)
- 🚀 [Quick Start](VERCEL_QUICK_START.md)
- 🏗️ [Architecture](docs/ARCHITECTURE.md)
- 🔧 [Troubleshooting](docs/TROUBLESHOOTING.md)

## Support

- Vercel Docs: https://vercel.com/docs
- GitHub Issues: https://github.com/akilhassane/pantheon/issues
- Vercel Support: https://vercel.com/support

## Next Steps

1. ✅ Deploy to Vercel
2. 📊 Set up monitoring
3. 🔒 Configure security
4. 🚀 Deploy client agents
5. 📈 Scale as needed

Happy deploying! 🎉
