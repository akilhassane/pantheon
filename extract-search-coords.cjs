const data = require('./raw-screenshot-data.json');

console.log('=== OCR TEXT "Search" occurrences ===');
const searchTexts = data.ocr_text.filter(t => t.text === 'Search');
searchTexts.forEach(s => {
  console.log(`Search at (${s.position.x}, ${s.position.y})`);
});

console.log('\n=== UI ELEMENTS "Search" occurrences ===');
if (data.ui_elements) {
  const searchElements = data.ui_elements.filter(e => e.name && e.name.includes('Search'));
  searchElements.forEach(e => {
    console.log(`"${e.name}" at (${e.x}, ${e.y}) - ${e.control_type_name}`);
  });
}
