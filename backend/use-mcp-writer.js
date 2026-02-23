/**
 * Simple script to test calling the MCP gotty-direct-writer
 * This writes commands to the visible terminal session
 */

const { spawn } = require('child_process');

async function writeCommandToTerminal(command) {
  return new Promise((resolve, reject) => {
    // Start the MCP server
    const mcp = spawn('node', ['mcp-server/gotty-direct-writer.js'], {
      env: { ...process.env, GOTTY_WS_URL: 'ws://kali-pentest:8080/ws' }
    });

    let output = '';
    let errorOutput = '';

    mcp.stdout.on('data', (data) => {
      output += data.toString();
    });

    mcp.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error('MCP stderr:', data.toString());
    });

    // Send MCP request to write command
    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'write_command',
        arguments: {
          command: command
        }
      }
    };

    mcp.stdin.write(JSON.stringify(request) + '\n');

    setTimeout(() => {
      mcp.kill();
      resolve({ output, errorOutput });
    }, 2000);

    mcp.on('error', reject);
  });
}

// Test it
if (require.main === module) {
  writeCommandToTerminal('whoami')
    .then(result => {
      console.log('Result:', result);
      process.exit(0);
    })
    .catch(err => {
      console.error('Error:', err);
      process.exit(1);
    });
}

module.exports = { writeCommandToTerminal };
