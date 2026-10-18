// Claude Code hook → notifies Neon Terminal (Stop / Notification / AskUserQuestion)
// Usage: node claude-hook.js <event>   (receives the hook JSON on stdin)
const http = require('http');
const fs = require('fs');

const event = process.argv[2] || 'unknown';
const { NEON_PORT, NEON_TOKEN, NEON_PTY_ID } = process.env;
if (!NEON_PORT) process.exit(0);

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => {
  let input = {};
  try { input = JSON.parse(raw || '{}'); } catch {}
  let message = '';

  if (event === 'stop') {
    message = input.last_assistant_message || lastAssistantText(input.transcript_path);
  } else if (event === 'notification') {
    message = input.message || '';
  } else if (event === 'question') {
    const q = input.tool_input && input.tool_input.questions && input.tool_input.questions[0];
    message = q ? q.question : 'Claude et fa una pregunta';
  }

  const body = JSON.stringify({ token: NEON_TOKEN, ptyId: Number(NEON_PTY_ID), event, message: String(message || '').slice(0, 600), cwd: input.cwd || '' });
  const req = http.request({ host: '127.0.0.1', port: NEON_PORT, path: '/claude', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 1500 },
    (res) => { res.resume(); res.on('end', () => process.exit(0)); });
  req.on('error', () => process.exit(0));
  req.on('timeout', () => { req.destroy(); process.exit(0); });
  req.end(body);
});

// Reads the assistant's last text from the transcript (JSONL)
function lastAssistantText(file) {
  try {
    const stat = fs.statSync(file);
    const size = Math.min(stat.size, 256 * 1024);
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(size);
    fs.readSync(fd, buf, 0, size, stat.size - size);
    fs.closeSync(fd);
    const lines = buf.toString('utf8').split('\n').reverse();
    for (const line of lines) {
      let j; try { j = JSON.parse(line); } catch { continue; }
      if (j.type !== 'assistant' || !j.message) continue;
      const content = Array.isArray(j.message.content) ? j.message.content : [];
      const text = content.filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
      if (text) return text;
    }
  } catch {}
  return '';
}
