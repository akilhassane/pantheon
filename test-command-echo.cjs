/**
 * Test Command Echo Functionality
 * Tests that commands are echoed to the terminal before execution
 */

const WebSocket = require('ws');

async function testCommandEcho() {
  console.log('🧪 Testing Command Echo Functionality\n');

  // Connect to backend WebSocket
  console.log('📡 Connecting to backend WebSocket...');
  const ws = new WebSocket('ws://localhost:3002');

  let commandEchoReceived = false;
  let commandText = '';

  ws.on('open', () => {
    console.log('✅ Connected to backend WebSocket\n');
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('📨 Received message:', message.type);

      if (message.type === 'command_echo') {
        commandEchoReceived = true;
        commandText = message.command;
        console.log('✅ Command echo received:', commandText);
        console.log('   Timestamp:', new Date(message.timestamp).toISOString());
      }
    } catch (error) {
      console.error('❌ Failed to parse message:', error);
    }
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
  });

  ws.on('close', () => {
    console.log('🔌 WebSocket closed');
  });

  // Wait for connection
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Send AI message that triggers command
  console.log('🤖 Sending AI message to execute command...');
  try {
    const response = await fetch('http://localhost:3002/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'run the command: whoami',
        history: [],
        model: 'gemini-2.0-flash-exp'
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ AI response received');
      console.log('   Response:', data.response.substring(0, 100) + '...');
    } else {
      console.error('❌ AI request failed:', response.statusText);
    }
  } catch (error) {
    console.error('❌ Failed to send AI message:', error.message);
  }

  // Wait for echo
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Check results
  console.log('\n📊 Test Results:');
  console.log('================');
  if (commandEchoReceived) {
    console.log('✅ Command echo: PASSED');
    console.log('   Command text:', commandText);
  } else {
    console.log('❌ Command echo: FAILED');
    console.log('   No command_echo message received');
  }

  // Close WebSocket
  ws.close();

  console.log('\n🏁 Test complete');
  process.exit(commandEchoReceived ? 0 : 1);
}

// Run test
testCommandEcho().catch(error => {
  console.error('❌ Test failed with error:', error);
  process.exit(1);
});
