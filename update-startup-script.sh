#!/bin/bash
# Update the startup script in the container

cat > /usr/local/bin/start-socat-proxy.sh << 'EOFSCRIPT'
#!/bin/bash
# Auto-start script for socat proxy with DNAT
# This allows Windows VM to access shared folder at 172.30.0.1:8888

echo "Setting up shared folder and Tools API access..."

# Get container IP and shared folder IP
CONTAINER_IP=$(ip -4 addr show eth0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -1)
SHARED_FOLDER_IP=$(getent hosts shared-folder-41e798b0 | awk '{print $1}')

if [ -z "$SHARED_FOLDER_IP" ]; then
    echo "ERROR: Could not find shared folder IP, using fallback"
    # Fallback: assume shared folder is at .20 in the same subnet
    SHARED_FOLDER_IP=$(echo $CONTAINER_IP | sed 's/\.[0-9]*$/.20/')
fi

echo "Container IP: $CONTAINER_IP"
echo "Shared folder IP: $SHARED_FOLDER_IP"

# Kill existing socat processes
pkill -9 -f "socat.*8888" 2>/dev/null || true
pkill -9 -f "socat.*8090" 2>/dev/null || true
sleep 1

# Start socat for shared folder (bind to container IP)
nohup socat TCP-LISTEN:8888,bind=$CONTAINER_IP,fork,reuseaddr TCP:$SHARED_FOLDER_IP:8888 > /tmp/socat-8888.log 2>&1 &
sleep 1

# Start socat for Tools API
nohup socat TCP-LISTEN:8090,fork,reuseaddr TCP:windows-tools-api:8090 > /tmp/socat-8090.log 2>&1 &
sleep 1

# Add IP alias for 172.30.0.1
ip addr add 172.30.0.1/32 dev eth0 2>/dev/null || echo "IP alias already exists"

# Setup DNAT to redirect 172.30.0.1:8888 to container IP
iptables -t nat -D OUTPUT -d 172.30.0.1 -p tcp --dport 8888 -j DNAT --to-destination $CONTAINER_IP:8888 2>/dev/null
iptables -t nat -D PREROUTING -d 172.30.0.1 -p tcp --dport 8888 -j DNAT --to-destination $CONTAINER_IP:8888 2>/dev/null
iptables -t nat -A OUTPUT -d 172.30.0.1 -p tcp --dport 8888 -j DNAT --to-destination $CONTAINER_IP:8888
iptables -t nat -A PREROUTING -d 172.30.0.1 -p tcp --dport 8888 -j DNAT --to-destination $CONTAINER_IP:8888

echo "Setup complete!"
echo "Windows VM can access shared folder at http://172.30.0.1:8888"
ps aux | grep socat | grep -v grep
EOFSCRIPT

chmod +x /usr/local/bin/start-socat-proxy.sh
echo "Startup script updated successfully"
