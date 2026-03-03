const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const model = process.env.OLLAMA_MODEL || 'deepseek-coder:6.7b-instruct-q4_K_M';
const promptFile = path.join(__dirname, 'prompt.txt');
const outFile = path.join(__dirname, 'challenges.json');

if (!fs.existsSync(promptFile)) {
  console.error('Missing prompt.txt in', __dirname);
  process.exit(2);
}

const prompt = fs.readFileSync(promptFile, 'utf8');

const proc = spawn('ollama', ['run', model], { stdio: ['pipe', 'pipe', 'inherit'] });

let stdout = '';
proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });

proc.on('error', (err) => {
  console.error('Failed to start ollama:', err.message);
  process.exit(3);
});

proc.on('close', (code) => {
  if (code !== 0) {
    console.error('ollama exited with code', code);
    process.exit(code);
  }

  try {
    fs.writeFileSync(outFile, stdout, 'utf8');
    console.log('Saved', outFile, '(', Buffer.byteLength(stdout, 'utf8'), 'bytes )');
  } catch (err) {
    console.error('Failed to write output file:', err.message);
    process.exit(4);
  }
});

proc.stdin.write(prompt);
proc.stdin.end();
