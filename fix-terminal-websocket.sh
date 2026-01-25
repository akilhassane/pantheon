#!/bin/bash
# Script to fix the terminal WebSocket URL in the container

# Find and backup the original terminal HTML
docker exec windows-project-21cecb6c bash -c "
# Find the terminal HTML file
TERM_HTML=\$(find /var/www /usr/share/nginx -name '*.html' -exec grep -l 'WebSocket' {} \; 2>/dev/null | head -1)

if [ -z \"\$TERM_HTML\" ]; then
  echo 'Terminal HTML not found'
  exit 1
fi

echo 'Found terminal HTML at:' \$TERM_HTML

# Backup original
cp \$TERM_HTML \${TERM_HTML}.backup

# Fix the WebSocket URL
sed -i 's|ws://\${window.location.hostname}:\${window.location.port || 9090}|(() => { const protocol = window.location.protocol === \"https:\" ? \"wss:\" : \"ws:\"; const port = window.location.port ? \":\" + window.location.port : \"\"; return protocol + \"//\" + window.location.hostname + port; })()|g' \$TERM_HTML

echo 'Terminal HTML fixed!'
"
