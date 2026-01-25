# Vercel Deployment - Quick Start

## 🚀 5-Minute Deployment

### 1. Install Vercel CLI
```bash
npm install -g vercel
```

### 2. Deploy Frontend
```bash
cd frontend
vercel --prod
```

When prompted:
- Set up and deploy: **Y**
- Which scope: Select your account
- Link to existing project: **N**
- Project name: **pantheon-frontend**
- Directory: **./frontend**
- Override settings: **N**

### 3. Deploy Backend
```bash
cd ../backend
vercel --prod
```

When prompted:
- Project name: **pantheon-backend**
- Directory: **./backend**

### 4. Set Environment Variables

**Frontend** (in Vercel dashboard):
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
NEXT_PUBLIC_API_URL=https://pantheon-backend.vercel.app
```

**Backend** (in Vercel dashboard):
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
SUPABASE_ANON_KEY=eyJxxx...
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-ant-xxx
GEMINI_API_KEY=xxx
CONTAINER_MODE=remote
NODE_ENV=production
```

### 5. Redeploy After Setting Variables
```bash
# Frontend
cd frontend
vercel --prod

# Backend
cd ../backend
vercel --prod
```

### 6. Deploy Client Agent

On each client machine:
```bash
cd client-agent
npm install
cp .env.example .env
# Edit .env with your Vercel backend URL
npm start
```

## 🎯 Your URLs

After deployment:
- **Frontend**: https://pantheon-frontend.vercel.app
- **Backend**: https://pantheon-backend.vercel.app

## ⚠️ Important Notes

1. **WebSockets**: Vercel has limited WebSocket support. For production, consider:
   - Deploy WebSocket server on Railway/Render
   - Use Server-Sent Events (SSE) instead
   - Use Supabase Realtime for updates

2. **Serverless Limits**:
   - Hobby: 10s timeout
   - Pro: 60s timeout
   - Use streaming for long operations

3. **Client Agents**: Must run on user machines (not on Vercel)

## 🔧 Troubleshooting

**Build fails?**
- Check `vercel logs` for errors
- Verify all dependencies in package.json
- Ensure environment variables are set

**API not working?**
- Check backend logs in Vercel dashboard
- Verify Supabase credentials
- Test with: `curl https://pantheon-backend.vercel.app/health`

**Client agent can't connect?**
- Use `wss://` (not `ws://`) for Vercel URLs
- Check API key is correct
- Verify firewall allows outbound connections

## 📚 Full Documentation

See `docs/VERCEL_DEPLOYMENT.md` for complete guide.

## 🆘 Need Help?

1. Check Vercel logs: `vercel logs`
2. Review deployment guide: `docs/VERCEL_DEPLOYMENT.md`
3. Open GitHub issue with error details
