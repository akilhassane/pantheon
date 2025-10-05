#!/bin/bash
# Additional Kali Tools Installation Script
# Run this inside the Kali container to install more specialized tools

echo "============================================================"
echo "Kali Linux - Additional Tools Installer"
echo "============================================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "This script needs sudo privileges. Attempting with sudo..."
    exec sudo bash "$0" "$@"
fi

echo "[1/4] Updating package lists..."
apt-get update

echo ""
echo "[2/4] Installing additional tool categories..."
echo "Select which tool categories to install:"
echo ""
echo "  1) Web Application Testing (burpsuite, zaproxy, etc.)"
echo "  2) Wireless Testing (aircrack-ng suite, reaver, etc.)"
echo "  3) Exploitation Tools (metasploit extras, veil, etc.)"
echo "  4) Password Attacks (hashcat, john extras, etc.)"
echo "  5) Forensics (autopsy, binwalk, etc.)"
echo "  6) All of the above"
echo "  0) Skip additional tools"
echo ""
read -p "Enter your choice (0-6): " choice

case $choice in
    1)
        echo "Installing web application testing tools..."
        apt-get install -y kali-tools-web
        ;;
    2)
        echo "Installing wireless testing tools..."
        apt-get install -y kali-tools-wireless
        ;;
    3)
        echo "Installing exploitation tools..."
        apt-get install -y kali-tools-exploitation
        ;;
    4)
        echo "Installing password attack tools..."
        apt-get install -y kali-tools-passwords
        ;;
    5)
        echo "Installing forensics tools..."
        apt-get install -y kali-tools-forensics
        ;;
    6)
        echo "Installing all tool categories (this will take a while)..."
        apt-get install -y kali-tools-web kali-tools-wireless \
            kali-tools-exploitation kali-tools-passwords kali-tools-forensics
        ;;
    0)
        echo "Skipping additional tools..."
        ;;
    *)
        echo "Invalid choice, skipping..."
        ;;
esac

echo ""
echo "[3/4] Installing useful utilities..."
apt-get install -y \
    tmux screen \
    htop glances \
    tree ripgrep bat \
    fzf

echo ""
echo "[4/4] Cleaning up..."
apt-get clean
rm -rf /var/lib/apt/lists/*

echo ""
echo "============================================================"
echo "Installation Complete!"
echo "============================================================"
echo ""
echo "Installed tools are ready to use."
echo ""

