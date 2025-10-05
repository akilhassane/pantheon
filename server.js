#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListPromptsRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class PentestForgeServer {
  constructor() {
    this.server = new Server(
      {
        name: 'mcp-pentest-forge',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupCatalogHandlers();
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'kali_execute',
            description: `Execute ANY command or workflow in Kali Linux with full system access and complete autonomy.

🎯 **COMPLETE SYSTEM CONTROL**
This tool provides UNRESTRICTED access to the entire Kali Linux operating system. You have full autonomy to:
- Execute ANY Linux command or tool
- Chain multiple commands intelligently
- Use shell scripting and automation
- Install new tools and packages
- Manage the entire system

🚀 **INTELLIGENT AUTOMATION**
You should interpret natural language requests and automatically:
1. Understand the user's security goal
2. Select the appropriate tools and techniques
3. Chain commands together intelligently
4. Execute complex multi-step workflows
5. Interpret results and adapt next steps
6. Handle errors and retry with different approaches

💡 **EXAMPLES OF NATURAL LANGUAGE TASKS**

"Discover all devices on my network"
→ Execute: nmap -sn 192.168.1.0/24 to find hosts
→ Parse results and extract IPs
→ For each IP: nmap -sV -O <IP> for detailed enumeration
→ Aggregate and present findings

"Find all vulnerabilities in my network"
→ Execute: nmap -sV -p- 192.168.1.0/24 for service detection
→ Run: nmap --script vuln on discovered services
→ Execute: nikto on web servers found
→ Run: enum4linux on SMB hosts found
→ Compile comprehensive vulnerability report

"Test website for SQL injection"
→ Crawl site to find parameters: sqlmap -u <url> --crawl=2
→ Test all parameters automatically
→ Enumerate databases if vulnerable
→ Extract sensitive data
→ Generate detailed report

"Enumerate SMB shares on my network"
→ Find SMB hosts: nmap -p 445 192.168.1.0/24
→ For each host: enum4linux -a <host>
→ List accessible shares: smbclient -L <host> -N
→ Attempt to access shares without credentials
→ Report accessible resources

🔧 **AVAILABLE CAPABILITIES**

**Pentesting Tools** (200+ tools available):
- Network: nmap, masscan, netcat, tcpdump, wireshark
- Web: nikto, sqlmap, burpsuite, gobuster, ffuf, wpscan
- Exploitation: metasploit, searchsploit, exploit-db
- Password: hydra, john, hashcat, medusa
- Wireless: aircrack-ng, kismet, reaver
- OSINT: theHarvester, maltego, recon-ng, sherlock
- Forensics: volatility, binwalk, exiftool, strings
- Reverse Engineering: ghidra, radare2, gdb

**System Commands**:
- File: ls, cd, find, grep, cat, touch, rm, cp, mv
- Process: ps, top, kill, systemctl
- Network: ifconfig, ip, netstat, ss, iptables
- User: whoami, sudo, useradd, passwd
- Package: apt, apt-get, dpkg, snap
- Text: sed, awk, grep, vi, nano
- Archive: tar, zip, unzip, gzip

**Shell Features**:
- && (and operator - execute if previous succeeds)
- || (or operator - execute if previous fails)
- | (pipe - pass output to next command)
- ; (sequential - execute commands in order)
- > (redirect output to file)
- >> (append to file)
- < (input from file)
- $() (command substitution)
- for/while loops, if/else statements
- Variables and functions
- Background jobs with &

📝 **USAGE INSTRUCTIONS**

**Simple Command**:
{
  "command": "nmap -sV 192.168.1.1"
}

**Complex Workflow**:
{
  "command": "nmap -sn 192.168.1.0/24 | grep 'Nmap scan report' | awk '{print $5}' | while read ip; do echo \"Scanning $ip\"; nmap -sV $ip; done"
}

**Multi-Step Process**:
{
  "command": "nmap -p 80,443 192.168.1.0/24 -oG - | grep open | awk '{print $2}' > /workspace/web_hosts.txt && while read host; do nikto -h $host; done < /workspace/web_hosts.txt"
}

⚠️ **AUTONOMOUS OPERATION**
You have COMPLETE autonomy to:
- Select any tools needed for the task
- Chain commands intelligently
- Retry with different approaches if one fails
- Interpret results and adapt strategy
- Execute complex multi-stage workflows
- Make decisions without asking for permission
- Handle errors gracefully

🔥 **UNRESTRICTED ACCESS**
- NO predefined commands or limits
- Execute ANY Kali Linux tool or command
- Full shell access with all operators
- Install new tools as needed
- Modify system configuration
- Access all files and processes
- Run as root (sudo available)

Let the AI handle the complexity - just understand the goal and execute intelligently.`,
            inputSchema: {
              type: 'object',
              properties: {
                command: {
                  type: 'string',
                  description: 'The complete command or command chain to execute in Kali Linux. Can include pipes, redirects, loops, conditionals, and any shell features. For complex tasks, chain multiple tools together intelligently.'
                }
              },
              required: ['command']
            }
          }
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (name === 'kali_execute') {
        return this.handleKaliExecute(args);
      } else {
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    });
  }

  setupCatalogHandlers() {
    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: 'pentest://tools/kali-tools-reference',
            name: 'Kali Linux Tools Reference',
            description: 'Comprehensive guide to 200+ Kali Linux tools',
            mimeType: 'text/markdown'
          },
          {
            uri: 'pentest://methodologies/network-pentest',
            name: 'Network Penetration Testing Methodology',
            description: 'Step-by-step network penetration testing guide',
            mimeType: 'text/markdown'
          },
          {
            uri: 'pentest://methodologies/web-app-pentest',
            name: 'Web Application Penetration Testing',
            description: 'Comprehensive web application security testing guide',
            mimeType: 'text/markdown'
          },
          {
            uri: 'pentest://workflows/automated-scanning',
            name: 'Automated Security Scanning Workflows',
            description: 'Pre-built command chains for common security tasks',
            mimeType: 'text/markdown'
          },
          {
            uri: 'pentest://examples/natural-language',
            name: 'Natural Language Task Examples',
            description: 'Examples of complex tasks and their command implementations',
            mimeType: 'text/markdown'
          }
        ]
      };
    });

    // Read resource content
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      switch (uri) {
        case 'pentest://tools/kali-tools-reference':
          return {
            contents: [
              {
                uri: uri,
                mimeType: 'text/markdown',
                text: `# Kali Linux Tools Reference

## Network Discovery & Scanning
- **nmap** - Network exploration and security auditing
- **masscan** - Fast port scanner
- **netdiscover** - Network address discovering tool
- **arp-scan** - ARP scanning and fingerprinting

## Web Application Testing
- **nikto** - Web server scanner
- **sqlmap** - SQL injection and database takeover
- **burpsuite** - Web vulnerability scanner
- **gobuster** - Directory/file & DNS busting
- **ffuf** - Fast web fuzzer
- **wpscan** - WordPress security scanner
- **dirb** - Web content scanner

## Password Attacks
- **hydra** - Network logon cracker
- **john** - John the Ripper password cracker
- **hashcat** - Advanced password recovery
- **medusa** - Parallel password cracker
- **crunch** - Wordlist generator

## Exploitation
- **metasploit** - Penetration testing framework
- **searchsploit** - Exploit database search
- **armitage** - Graphical cyber attack management

## OSINT & Reconnaissance
- **theHarvester** - E-mail, subdomain and people names harvester
- **maltego** - Data mining tool
- **recon-ng** - Web reconnaissance framework
- **sherlock** - Hunt down social media accounts
- **sublist3r** - Subdomain enumeration

## Wireless Attacks
- **aircrack-ng** - WiFi security auditing
- **kismet** - Wireless network detector
- **reaver** - WPS brute force attack

## Forensics & Analysis
- **volatility** - Memory forensics framework
- **binwalk** - Firmware analysis tool
- **exiftool** - Meta information reader/writer
- **strings** - Print strings in files

## Reverse Engineering
- **ghidra** - Software reverse engineering suite
- **radare2** - Reverse engineering framework
- **gdb** - GNU debugger

## Sniffing & Spoofing
- **wireshark** - Network protocol analyzer
- **tcpdump** - Network packet analyzer
- **ettercap** - Man-in-the-middle attack tool
- **bettercap** - Network attack and monitoring

And 150+ more tools available...`
              }
            ]
          };

        case 'pentest://methodologies/network-pentest':
          return {
            contents: [
              {
                uri: uri,
                mimeType: 'text/markdown',
                text: `# Network Penetration Testing Methodology

## Phase 1: Reconnaissance
1. **Passive Information Gathering**
   - WHOIS lookups: \`whois domain.com\`
   - DNS enumeration: \`dig domain.com ANY\`
   - Search engine discovery: \`theHarvester -d domain.com -b google\`

2. **Active Information Gathering**
   - Network discovery: \`nmap -sn 192.168.1.0/24\`
   - Live host detection
   - Network mapping

## Phase 2: Scanning & Enumeration
1. **Port Scanning**
   - Quick scan: \`nmap -sV --top-ports 1000 target\`
   - Comprehensive: \`nmap -sV -sC -p- target\`
   - Fast scan: \`masscan -p1-65535 target --rate=10000\`

2. **Service Enumeration**
   - HTTP: \`nikto -h http://target\`
   - SMB: \`enum4linux -a target\`
   - SNMP: \`snmp-check target\`

## Phase 3: Vulnerability Assessment
- \`nmap --script vuln target\`
- \`nikto -h http://target\`
- \`openvas\` (if configured)

## Phase 4: Exploitation
- Search exploits: \`searchsploit service_name\`
- Metasploit framework
- Manual exploitation

## Phase 5: Post-Exploitation
- Privilege escalation
- Lateral movement
- Data exfiltration
- Persistence`
              }
            ]
          };

        case 'pentest://workflows/automated-scanning':
          return {
            contents: [
              {
                uri: uri,
                mimeType: 'text/markdown',
                text: `# Automated Security Scanning Workflows

## Complete Network Discovery & Enumeration
\`\`\`bash
# Discover hosts and enumerate services automatically
nmap -sn 192.168.1.0/24 -oG - | grep Up | awk '{print $2}' > /workspace/hosts.txt && \\
while read host; do \\
  echo "Scanning $host"; \\
  nmap -sV -sC -p- $host -oN /workspace/scan_$host.txt; \\
done < /workspace/hosts.txt
\`\`\`

## Web Application Vulnerability Scan
\`\`\`bash
# Find web servers and scan them
nmap -p 80,443,8080,8443 192.168.1.0/24 -oG - | grep open | awk '{print $2}' > /workspace/web_hosts.txt && \\
while read host; do \\
  nikto -h $host -output /workspace/nikto_$host.txt; \\
  gobuster dir -u http://$host -w /usr/share/wordlists/dirb/common.txt; \\
done < /workspace/web_hosts.txt
\`\`\`

## SMB Enumeration Pipeline
\`\`\`bash
# Find and enumerate all SMB hosts
nmap -p 445 192.168.1.0/24 --open -oG - | grep open | awk '{print $2}' > /workspace/smb_hosts.txt && \\
while read host; do \\
  echo "Enumerating $host"; \\
  enum4linux -a $host > /workspace/enum4linux_$host.txt; \\
  smbclient -L $host -N; \\
done < /workspace/smb_hosts.txt
\`\`\`

## Comprehensive Vulnerability Assessment
\`\`\`bash
# Multi-tool vulnerability scan
nmap -sV --script vuln 192.168.1.0/24 -oN /workspace/vuln_scan.txt && \\
nmap -p 80,443 192.168.1.0/24 --open -oG - | grep open | awk '{print $2}' | \\
while read ip; do \\
  nikto -h $ip >> /workspace/web_vulns.txt; \\
done
\`\`\``
              }
            ]
          };

        case 'pentest://examples/natural-language':
          return {
            contents: [
              {
                uri: uri,
                mimeType: 'text/markdown',
                text: `# Natural Language Task Examples

## Example 1: "Discover all devices on my network"
**Command Implementation:**
\`\`\`bash
# Get network range
ip addr show | grep "inet " | grep -v "127.0.0.1" | awk '{print $2}' | head -n 1 > /tmp/network.txt && \\
network=$(cat /tmp/network.txt) && \\
# Discover hosts
nmap -sn $network -oG - | grep "Up" | awk '{print $2, $3}' > /workspace/discovered_hosts.txt && \\
# Enumerate each host
while read ip name; do \\
  echo "Scanning $ip ($name)"; \\
  nmap -sV -O -p- $ip -oN /workspace/host_$ip.txt; \\
done < /workspace/discovered_hosts.txt && \\
# Summarize findings
echo "Network Discovery Complete" && cat /workspace/discovered_hosts.txt
\`\`\`

## Example 2: "Find all web servers and check for vulnerabilities"
**Command Implementation:**
\`\`\`bash
# Find web servers
nmap -p 80,443,8080,8443,8000,8888 192.168.1.0/24 --open -oG - | grep open | awk '{print $2}' > /workspace/web_servers.txt && \\
# Scan each with multiple tools
while read ip; do \\
  echo "Testing $ip"; \\
  # Nikto scan
  nikto -h $ip -output /workspace/nikto_$ip.txt; \\
  # Directory enumeration
  gobuster dir -u http://$ip -w /usr/share/wordlists/dirb/common.txt -o /workspace/dirs_$ip.txt 2>/dev/null; \\
  # Vulnerability scripts
  nmap --script http-vuln* -p 80,443,8080 $ip -oN /workspace/vulns_$ip.txt; \\
done < /workspace/web_servers.txt && \\
# Compile results
echo "Web vulnerability scan complete"
\`\`\`

## Example 3: "Test if this website is vulnerable to SQL injection"
**Command Implementation:**
\`\`\`bash
# Test URL for SQL injection
url="http://target.com/page?id=1" && \\
# Use sqlmap with intelligent options
sqlmap -u "$url" --batch --level=5 --risk=3 --dbs --output-dir=/workspace/sqlmap_results && \\
# If databases found, enumerate
if grep -q "available databases" /workspace/sqlmap_results/*; then \\
  sqlmap -u "$url" --batch -D targetdb --tables; \\
  sqlmap -u "$url" --batch -D targetdb -T users --dump; \\
fi
\`\`\`

## Example 4: "Perform a complete security audit of 192.168.1.100"
**Command Implementation:**
\`\`\`bash
target="192.168.1.100" && \\
# Comprehensive port scan
nmap -sV -sC -p- -O $target -oN /workspace/full_scan_$target.txt && \\
# Web vulnerability scan if web ports open
if grep -E "80/tcp.*open|443/tcp.*open" /workspace/full_scan_$target.txt; then \\
  nikto -h $target -output /workspace/nikto_$target.txt; \\
fi && \\
# SMB enumeration if port 445 open
if grep "445/tcp.*open" /workspace/full_scan_$target.txt; then \\
  enum4linux -a $target > /workspace/smb_$target.txt; \\
fi && \\
# Vulnerability assessment
nmap --script vuln $target -oN /workspace/vulns_$target.txt && \\
echo "Complete audit finished for $target"
\`\`\``
              }
            ]
          };

        default:
          throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
      }
    });

    // List available prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: [
          {
            name: 'network-discovery',
            description: 'Discover and enumerate all devices on a network',
            arguments: [
              {
                name: 'network_range',
                description: 'Network CIDR (e.g., 192.168.1.0/24)',
                required: false
              }
            ]
          },
          {
            name: 'web-vulnerability-scan',
            description: 'Comprehensive web application security testing',
            arguments: [
              {
                name: 'target_url',
                description: 'Target web application URL',
                required: true
              }
            ]
          },
          {
            name: 'complete-pentest',
            description: 'Full penetration test of target system',
            arguments: [
              {
                name: 'target',
                description: 'Target IP or hostname',
                required: true
              }
            ]
          }
        ]
      };
    });
  }

  // Universal Kali command executor
  async handleKaliExecute(args) {
    const { command } = args;

    if (!command) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: No command provided. Please specify a command to execute.'
          }
        ]
      };
    }

    try {
      console.error(`Executing in Kali container: ${command}`);
      
      // Execute command in Kali container with full shell support
      const dockerCommand = `docker exec kali-pentest bash -c ${JSON.stringify(command)}`;
      const { stdout, stderr } = await execAsync(dockerCommand, { 
        timeout: 600000, // 10 minute timeout
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      return {
        content: [
          {
            type: 'text',
            text: `✓ Command executed successfully\n\n**Command:**\n\`\`\`bash\n${command}\n\`\`\`\n\n**Output:**\n\`\`\`\n${stdout || '(no output)'}\n\`\`\`${stderr ? `\n\n**Stderr:**\n\`\`\`\n${stderr}\n\`\`\`` : ''}\n\n✓ Executed in Kali Linux container`
          }
        ]
      };
    } catch (error) {
      console.error(`Error executing command: ${error.message}`);
      
      return {
        content: [
          {
            type: 'text',
            text: `⚠️ Error executing command\n\n**Command:**\n\`\`\`bash\n${command}\n\`\`\`\n\n**Error:**\n\`\`\`\n${error.message}\n\`\`\`\n\n**Troubleshooting:**\n- Ensure Kali container is running: \`docker ps | grep kali-pentest\`\n- Start container if needed: \`docker start kali-pentest\`\n- Check container logs: \`docker logs kali-pentest\`\n- Verify command syntax\n\nIf the command is valid, try breaking it into smaller steps or using different syntax.`
          }
        ]
      };
    }
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MCP Pentest Forge Server started with UNRESTRICTED Kali Linux access');
    console.error('AI has COMPLETE autonomy to execute any commands and workflows');
  }
}

const server = new PentestForgeServer();
server.start().catch(console.error);
