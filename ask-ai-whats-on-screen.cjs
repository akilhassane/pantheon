#!/usr/bin/env node
/**
 * Take a screenshot and ask AI to describe what it sees
 * Uses Gemini Vision API
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Load environment variables
require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('Error: GEMINI_API_KEY not found in environment');
  process.exit(1);
}

async function takeScreenshot() {
  console.log('Taking screenshot...');
  
  const screenshotPath = path.join(__dirname, 'current-screen.png');
  
  // Take screenshot using Python tool
  const pythonScript = path.join(__dirname, 'docker', 'windows-tools-api', 'tools', 'screenshot.py');
  
  try {
    execSync(`python "${pythonScript}" --output "${screenshotPath}" --no-ocr --no-ui`, {
      stdio: 'inherit'
    });
    
    console.log(`✓ Screenshot saved to: ${screenshotPath}\n`);
    return screenshotPath;
  } catch (error) {
    console.error('Failed to take screenshot:', error.message);
    process.exit(1);
  }
}

async function analyzeWithGemini(imagePath) {
  console.log('Analyzing screenshot with Gemini Vision...\n');
  
  // Read image and convert to base64
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  
  const prompt = `Please describe what you see in this screenshot in detail. Include:
1. What application or window is currently active
2. What UI elements are visible (buttons, menus, text fields, etc.)
3. What the user appears to be doing
4. Any notable content or information displayed
5. The overall layout and organization of the screen`;

  const requestBody = {
    contents: [{
      parts: [
        { text: prompt },
        {
          inline_data: {
            mime_type: 'image/png',
            data: base64Image
          }
        }
      ]
    }]
  };

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      const description = data.candidates[0].content.parts[0].text;
      
      console.log('='.repeat(80));
      console.log('AI VISION ANALYSIS');
      console.log('='.repeat(80));
      console.log();
      console.log(description);
      console.log();
      console.log('='.repeat(80));
      
      return description;
    } else {
      throw new Error('Unexpected response format from Gemini');
    }
  } catch (error) {
    console.error('Error analyzing image:', error.message);
    process.exit(1);
  }
}

// Main execution
async function main() {
  console.log('AI Screen Analyzer');
  console.log('='.repeat(80));
  console.log();
  
  const screenshotPath = await takeScreenshot();
  await analyzeWithGemini(screenshotPath);
  
  console.log('\n✓ Analysis complete!');
}

main().catch(console.error);
