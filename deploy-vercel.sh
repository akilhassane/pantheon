#!/bin/bash

# Pantheon Vercel Deployment Script

echo "🚀 Pantheon Vercel Deployment Helper"
echo "===================================="
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
fi

echo "📋 Deployment Steps:"
echo ""
echo "1. Deploy Frontend"
echo "2. Deploy Backend"
echo "3. Configure Environment Variables"
echo "4. Test Deployment"
echo ""

read -p "Deploy frontend? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🎨 Deploying frontend..."
    cd frontend
    vercel --prod
    cd ..
    echo "✅ Frontend deployed!"
fi

echo ""
read -p "Deploy backend? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "⚙️  Deploying backend..."
    cd backend
    vercel --prod
    cd ..
    echo "✅ Backend deployed!"
fi

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "1. Set environment variables in Vercel dashboard"
echo "2. Update NEXT_PUBLIC_API_URL in frontend"
echo "3. Deploy client agents to user machines"
echo "4. Test the application"
echo ""
echo "📖 Full guide: docs/VERCEL_DEPLOYMENT.md"
