// Script to disable verbose console logs in frontend/app/page.tsx
const fs = require('fs');

const filePath = 'frontend/app/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// List of log patterns to disable (comment out)
const logsToDisable = [
  /console\.log\('🔗 VNC URL Configuration:'/,
  /console\.log\('⚙️ Settings updated \(custom event\), reloading models\.\.\.'\)/,
  /console\.log\('⚙️ Settings updated \(custom event\), reloading custom modes\.\.\.'\)/,
  /console\.log\('📋 Loaded custom modes from backend API \(local database\):'/,
  /console\.log\('📋 Loaded custom modes from localStorage:'/,
  /console\.log\('📋 Loaded custom modes from localStorage \(fallback\):'/,
  /console\.log\('📋 \[useEffect\] Loaded models from settings:'/,
  /console\.log\('🎯 \[useEffect\] Auto-selecting default model:'/,
  /console\.log\('🎯 \[useEffect\] Auto-selecting fallback model'\)/,
  /console\.log\('🔄 \[SYNC\] Checking if we need to sync selectedCustomMode:'/,
  /console\.log\('✅ \[Model Validation\] Selected model is valid:'/,
  /\{user && console\.log\('🔍 Settings user data:'/,
  /\{user && console\.log\('🔍 Sidebar user data:'/,
];

console.log('Disabling verbose logs in', filePath);

// Comment out each log
logsToDisable.forEach(pattern => {
  const regex = new RegExp(`(\\s*)(${pattern.source}[^}]*}\\))`, 'g');
  content = content.replace(regex, '$1// $2 // Disabled to reduce log spam');
});

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Verbose logs disabled');
