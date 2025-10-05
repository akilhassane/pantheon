# MCP-Pentest-Forge 🔒⚡

[![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Kali Linux](https://img.shields.io/badge/Kali-268BEE?style=for-the-badge&logo=kalilinux&logoColor=white)](https://www.kali.org/)
[![Node.js](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)

## Overview

**MCP-Pentest-Forge** is a powerful Model Context Protocol (MCP) server that provides unrestricted access to a **Kali Linux pentesting environment**. This tool empowers security professionals and penetration testers to perform comprehensive security assessments using 200+ security tools through natural language commands.

## 🎯 Key Features

- **🤖 AI-Powered Pentesting**: Execute complex security workflows using natural language
- **🔓 Unrestricted Kali Access**: Full command-line access to Kali Linux with 200+ pentesting tools
- **🌐 Real Network Scanning**: Host network mode allows scanning your actual network devices
- **🛠️ Complete Tool Arsenal**: nmap, metasploit, burpsuite, sqlmap, nikto, and 200+ more tools
- **📚 Built-in Knowledge Base**: Comprehensive pentesting methodologies and workflows
- **🔄 Intelligent Automation**: AI automatically chains commands for complex multi-step tasks

## 🚀 What Makes This Unique

Unlike traditional pentesting tools, MCP-Pentest-Forge gives **AI complete autonomy** to:
- Interpret your natural language requests
- Select appropriate tools automatically
- Chain multiple commands intelligently
- Adapt strategy based on results
- Execute complex multi-stage workflows

**Example Natural Language Commands:**
- "Discover all devices on my network"
- "Find all vulnerabilities in 192.168.1.100"
- "Test this website for SQL injection"
- "Enumerate SMB shares on my network"

The AI handles all the complexity—selecting tools, crafting commands, interpreting results, and adapting the approach.

## ⚠️ Ethical Use Only

This tool is designed exclusively for **authorized security testing and research purposes**. Users are responsible for:
- Obtaining proper authorization before testing
- Complying with applicable laws and regulations
- Following responsible disclosure practices
- Using the tool ethically and legally

## 📦 Installation

### Prerequisites

- **Docker** and **Docker Compose** installed
- **Git** for cloning the repository
- For Windows: **WSL2** backend enabled in Docker Desktop

### Quick Start

```bash
# Clone the repository
git clone https://github.com/akilhassane/mcp-pentest-forge.git

# Navigate to the directory
cd mcp-pentest-forge

# Build and start both containers (MCP server + Kali Linux)
docker-compose up -d

# Check containers are running
docker ps

# View logs
docker-compose logs -f
```

That's it! Both the MCP server and Kali Linux environment are now running.

## 🎮 Usage

### Integration with MCP Clients

This server uses the **Model Context Protocol (MCP)** and communicates via stdio. Connect it to MCP-compatible clients:

#### Claude Desktop Configuration

Add to your Claude Desktop config file:

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`  
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "pentest-forge": {
      "command": "docker",
      "args": [
        "exec",
        "-i",
        "mcp-pentest-forge",
        "node",
        "/app/server.js"
      ]
    }
  }
}
```

### Available Tool: `kali_execute`

The server provides a single powerful tool:

**`kali_execute`** - Execute ANY command in Kali Linux with complete autonomy

#### Natural Language Examples

```
👤 You: "Discover all devices on my network"

🤖 AI: Executes:
  - nmap -sn 192.168.1.0/24 to find hosts
  - Parses results and extracts IPs
  - For each IP: nmap -sV -O <IP> for detailed enumeration
  - Aggregates and presents findings

👤 You: "Test website for SQL injection"

🤖 AI: Executes:
  - Crawls site to find parameters
  - Tests all parameters with sqlmap
  - Enumerates databases if vulnerable
  - Generates detailed report

👤 You: "Find all open SMB shares on my network"

🤖 AI: Executes:
  - nmap -p 445 192.168.1.0/24 to find SMB hosts
  - enum4linux -a on each host
  - Lists accessible shares
  - Reports accessible resources
```

### Direct Container Access

```bash
# Access Kali Linux shell
docker exec -it kali-pentest bash

# Run commands directly in Kali
docker exec kali-pentest nmap -sV 192.168.1.1

# View MCP server logs
docker logs -f mcp-pentest-forge

# Restart containers
docker-compose restart

# Stop containers
docker-compose down
```

## 🌐 Network Configuration

### Host Network Mode

The containers use **host network mode** for real network access:

**✅ Advantages:**
- Scan your actual network devices (not isolated Docker network)
- All pentesting tools work with real network interfaces
- No port mapping needed

**⚠️ Considerations:**
- Containers can access all host network resources
- Works natively on Linux/macOS
- Windows requires WSL2 backend for full functionality

**🔐 Security Note:** Only use in controlled, authorized environments.

## 🛠️ Available Pentesting Tools (200+)

### Network Discovery & Scanning
- **nmap, masscan, netdiscover, arp-scan**

### Web Application Testing
- **nikto, sqlmap, burpsuite, gobuster, ffuf, wpscan, dirb**

### Password Attacks
- **hydra, john, hashcat, medusa, crunch**

### Exploitation
- **metasploit, searchsploit, exploit-db**

### OSINT & Reconnaissance
- **theHarvester, maltego, recon-ng, sherlock, sublist3r**

### Wireless Attacks
- **aircrack-ng, kismet, reaver**

### Forensics & Analysis
- **volatility, binwalk, exiftool, strings**

### Reverse Engineering
- **ghidra, radare2, gdb**

### Sniffing & Spoofing
- **wireshark, tcpdump, ettercap, bettercap**

And many more...

## 🤝 Contributing

We welcome contributions from the security research community! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit your changes**: `git commit -m 'Add amazing feature'`
4. **Push to the branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

Please ensure all contributions:
- Align with ethical hacking principles
- Follow responsible disclosure practices
- Include appropriate documentation
- Are tested in a safe environment

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details

## ⚖️ Legal Disclaimer

**IMPORTANT:** This tool is intended for **educational and authorized security research purposes ONLY**.

### Legal Requirements

✅ **Always obtain written authorization** before testing any systems  
✅ **Comply with all applicable laws** in your jurisdiction  
✅ **Follow responsible disclosure** practices  
✅ **Respect privacy and data protection** laws  

### Prohibited Uses

❌ Unauthorized access to systems or networks  
❌ Malicious activities or attacks  
❌ Violation of terms of service  
❌ Any illegal activities  

### Liability

The authors and contributors of MCP-Pentest-Forge:
- Are NOT responsible for any misuse of this tool
- Do NOT condone illegal activities
- Provide this tool "AS IS" without warranties
- Disclaim all liability for damages resulting from use

**By using this tool, you agree to use it legally, ethically, and responsibly.**

## 🙏 Acknowledgments

- Built with the [Model Context Protocol](https://modelcontextprotocol.io/)
- Powered by [Kali Linux](https://www.kali.org/)
- Inspired by the cybersecurity community

---

**Built with ❤️ for ethical hackers and security researchers**

**⭐ Star this repo if you find it useful!**
