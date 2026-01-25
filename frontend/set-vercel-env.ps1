$env:NEXT_PUBLIC_BACKEND_URL = "https://pantheon-production-ad27.up.railway.app"
$env:NEXT_PUBLIC_SUPABASE_URL = "https://ekkrtmslvdypwilhdpgk.supabase.co"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVra3J0bXNsdmR5cHdpbGhkcGdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0NjgxNTcsImV4cCI6MjA3ODA0NDE1N30.7fecWmwvVDvjwRbphqMu4B5vRnrE4lEHfnMZ6tPjL4U"

Write-Host "Setting NEXT_PUBLIC_BACKEND_URL..."
Write-Output "n" | vercel env add NEXT_PUBLIC_BACKEND_URL production --sensitive=false

Write-Host "Setting NEXT_PUBLIC_SUPABASE_URL..."  
Write-Output "n" | vercel env add NEXT_PUBLIC_SUPABASE_URL production --sensitive=false

Write-Host "Setting NEXT_PUBLIC_SUPABASE_ANON_KEY..."
Write-Output "n" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production --sensitive=false
