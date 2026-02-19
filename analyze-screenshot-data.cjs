#!/usr/bin/env node

const fs = require('fs');

const data = JSON.parse(fs.readFileSync('raw-screenshot-data.json'));

console.log('='.repeat(80));
console.log('SCREENSHOT DATA ANALYSIS - EVERYTHING THE AI CAN SEE');
console.log('='.repeat(80));

console.log('\n📊 SCREEN INFO:');
console.log('Resolution:', data.size.width + 'x' + data.size.height);
console.log('Mouse Position:', '(' + data.mousePosition.x + ', ' + data.mousePosition.y + ')');

console.log('\n🪟 WINDOWS (' + data.windowsAPI.windows.length + ' total):');
data.windowsAPI.windows.forEach((w, i) => {
  const focused = w.is_focused ? ' [FOCUSED]' : '';
  console.log((i+1) + '. "' + w.name + '" at (' + w.x + ', ' + w.y + ') - ' + w.width + 'x' + w.height + focused);
});

console.log('\n📌 TASKBAR ICONS (' + data.windowsAPI.taskbar_icons.length + ' total):');
data.windowsAPI.taskbar_icons.forEach((icon, i) => {
  console.log((i+1) + '. "' + icon.name + '" at (' + icon.center_x + ', ' + icon.center_y + ')');
});

console.log('\n📦 UI ELEMENTS (' + data.windowsAPI.elements.length + ' total):');
const types = {};
data.windowsAPI.elements.forEach(el => {
  types[el.type] = (types[el.type] || 0) + 1;
});
Object.entries(types).forEach(([type, count]) => {
  console.log('- ' + type + ': ' + count);
});

console.log('\n🔍 DETAILED UI ELEMENTS (all ' + data.windowsAPI.elements.length + '):');
data.windowsAPI.elements.forEach((el, i) => {
  console.log((i+1) + '. [' + el.type + '] "' + el.name + '" at (' + el.center_x + ', ' + el.center_y + ')');
});

console.log('\n📝 OCR TEXT (' + data.ocr.textElements.length + ' total):');
data.ocr.textElements.forEach((t, i) => {
  const x = t.center?.x || t.position?.x || t.x;
  const y = t.center?.y || t.position?.y || t.y;
  const conf = t.confidence ? t.confidence.toFixed(2) : 'N/A';
  console.log((i+1) + '. "' + t.text + '" at (' + x + ', ' + y + ') - confidence: ' + conf);
});

console.log('\n' + '='.repeat(80));
console.log('SUMMARY:');
console.log('='.repeat(80));
console.log('Total Windows:', data.windowsAPI.windows.length);
console.log('Total Taskbar Icons:', data.windowsAPI.taskbar_icons.length);
console.log('Total UI Elements:', data.windowsAPI.elements.length);
console.log('Total OCR Text:', data.ocr.textElements.length);
console.log('\nFocused Window:', data.windowsAPI.focused_window || 'None');

console.log('\n' + '='.repeat(80));
console.log('WHAT THE AI RECEIVES (formatted):');
console.log('='.repeat(80));

// Simulate what the backend sends to the AI
console.log('\nWINDOWS:');
data.windowsAPI.windows.slice(0, 3).forEach(w => {
  console.log('- "' + w.name + '" at (' + w.x + ', ' + w.y + ')');
});

console.log('\nKEY ELEMENTS (top 5 clickable):');
const buttons = data.windowsAPI.elements.filter(el => 
  el.type === 'Button' || el.type === 'Edit' || el.type === 'TaskbarButton'
);
buttons.slice(0, 5).forEach(el => {
  console.log('- [' + el.type + '] "' + el.name + '" at (' + el.center_x + ', ' + el.center_y + ')');
});

console.log('\nTEXT (top 10 high confidence):');
const highConfText = data.ocr.textElements
  .filter(t => !t.confidence || t.confidence > 0.7)
  .slice(0, 10);
highConfText.forEach(t => {
  const x = t.center?.x || t.position?.x || t.x;
  const y = t.center?.y || t.position?.y || t.y;
  console.log('- "' + t.text + '" at (' + x + ', ' + y + ')');
});

console.log('\n' + '='.repeat(80));
console.log('✅ This is ALL the data the AI can analyze from the screenshot');
console.log('='.repeat(80));
