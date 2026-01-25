# Kali AI Backend

AI-powered command executor for Kali Linux using Google Gemini.

## Security Features

✅ **Environment Variables**: API keys stored in `.env` file (not committed to git)
✅ **Gitignore**: `.env` file excluded from version control
✅ **Command Safety**: Dangerous commands require explicit confirmation
✅ **Docker Isolation**: Commands execute in isolated container
✅ **CORS Protection**: Only configured origins allowed

## Setup

1. Create `.env` file with your Gemini API key:
```
GEMINI_API_KEY=your_key_here
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

## API Endpoints

### POST /api/chat
Send natural language commands to the AI agent.

**Request:**
```json
{
  "message": "list all files in /home",
  "history": []
}
```

**Response:**
```json
{
  "response": "I'll list the files...",
  "commandOutput": "file1\nfile2\n...",
  "success": true
}
```

### GET /health
Health check endpoint.

## Safety Features

The AI agent includes safety checks for:
- Destructive file operations (`rm -rf /`)
- Disk operations (`dd`, `mkfs`)
- Fork bombs
- Other dangerous patterns

Dangerous commands require explicit confirmation from the user.
