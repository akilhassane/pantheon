const fs = require('fs');

// Read the raw screenshot data
const data = JSON.parse(fs.readFileSync('raw-screenshot-data.json', 'utf8'));

console.log('\n🔍 Analyzing YouTube Search Elements\n');
console.log('=' .repeat(80));

// Get OCR text with "search" in it
const ocrTexts = data.ocr || data.ocr_text || [];
const searchOCR = Array.isArray(ocrTexts) ? ocrTexts.filter(ocr => 
  ocr.text && ocr.text.toLowerCase().includes('search')
) : [];

console.log(`\n📝 OCR Text containing "search" (${searchOCR.length}):\n`);
searchOCR.forEach(ocr => {
  console.log(`  Text: "${ocr.text}"`);
  console.log(`  Position: x=${ocr.x}, y=${ocr.y}, w=${ocr.width}, h=${ocr.height}`);
  console.log(`  Center: (${ocr.x + ocr.width/2}, ${ocr.y + ocr.height/2})`);
  console.log('');
});

// Get UI elements with "search" in name
const elements = data.windowsAPI?.elements || [];
const searchElements = elements.filter(el => 
  el.name && el.name.toLowerCase().includes('search')
);

console.log(`\n🎯 UI Elements containing "search" (${searchElements.length}):\n`);
searchElements.forEach(el => {
  console.log(`  Name: "${el.name}"`);
  console.log(`  Type: ${el.type || el.control_type_name}`);
  console.log(`  Position: x=${el.x}, y=${el.y}, w=${el.width}, h=${el.height}`);
  console.log(`  Center: (${el.center_x}, ${el.center_y})`);
  console.log('');
});

// Find Edit controls (text inputs)
const editControls = elements.filter(el => 
  (el.type === 'Edit' || el.control_type_name === 'Edit')
);

console.log(`\n✏️  All Edit Controls (${editControls.length}):\n`);
editControls.forEach(el => {
  console.log(`  Name: "${el.name}"`);
  console.log(`  Position: x=${el.x}, y=${el.y}, w=${el.width}, h=${el.height}`);
  console.log(`  Center: (${el.center_x}, ${el.center_y})`);
  console.log('');
});

// Find elements near OCR "Search" text
if (searchOCR.length > 0) {
  const searchText = searchOCR[0];
  const searchTextCenterX = searchText.x + searchText.width / 2;
  const searchTextCenterY = searchText.y + searchText.height / 2;
  
  console.log(`\n🎯 Elements near OCR "Search" text at (${searchTextCenterX}, ${searchTextCenterY}):\n`);
  
  // Find elements within 100px of the OCR text
  const nearbyElements = elements.filter(el => {
    const distance = Math.sqrt(
      Math.pow(el.center_x - searchTextCenterX, 2) + 
      Math.pow(el.center_y - searchTextCenterY, 2)
    );
    return distance < 100;
  });
  
  nearbyElements.forEach(el => {
    const distance = Math.sqrt(
      Math.pow(el.center_x - searchTextCenterX, 2) + 
      Math.pow(el.center_y - searchTextCenterY, 2)
    );
    console.log(`  Name: "${el.name}"`);
    console.log(`  Type: ${el.type || el.control_type_name}`);
    console.log(`  Center: (${el.center_x}, ${el.center_y})`);
    console.log(`  Distance from OCR: ${Math.round(distance)}px`);
    console.log('');
  });
}

console.log('=' .repeat(80));
