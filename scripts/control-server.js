#!/usr/bin/env node

const http = require('http');
const { spawn } = require('child_process');
const { URL } = require('url');
const path = require('path');

const HOST = process.env.CONTROL_BIND || '0.0.0.0';
const PORT = Number(process.env.CONTROL_PORT || 3123);
const DEFAULT_MODE = process.env.CONTROL_MODE || 'vpn';
const DEFAULT_EXPOSE = process.env.CONTROL_EXPOSE || 'funnel';
const CONTROL_TOKEN = process.env.CONTROL_TOKEN || '';
const ROOT_DIR = path.resolve(__dirname, '..');
const START_SCRIPT = path.join(ROOT_DIR, 'scripts', 'start-public.sh');
const STOP_SCRIPT = path.join(ROOT_DIR, 'scripts', 'stop-public.sh');

let currentJob = null;
let lastOutput = '';
let lastExitCode = null;
let lastAction = 'idle';

function isPrivateAddress(remoteAddress) {
  if (!remoteAddress) return false;
  const normalized = remoteAddress.replace(/^::ffff:/, '');

  return (
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized.startsWith('10.') ||
    normalized.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized) ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd')
  );
}

function hasValidToken(reqUrl, headers) {
  if (!CONTROL_TOKEN) return true;
  return (
    reqUrl.searchParams.get('token') === CONTROL_TOKEN ||
    headers['x-control-token'] === CONTROL_TOKEN
  );
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function runCommand(label, command) {
  if (currentJob) {
    return Promise.reject(new Error(`Another action is already running: ${currentJob.label}`));
  }

  return new Promise((resolve, reject) => {
    lastAction = label;
    lastOutput = '';
    lastExitCode = null;

    const child = spawn('/usr/bin/env', ['bash', '-lc', command], {
      cwd: ROOT_DIR,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    currentJob = { label, child, startedAt: new Date().toISOString() };

    child.stdout.on('data', (chunk) => {
      lastOutput += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      lastOutput += chunk.toString();
    });

    child.on('error', (error) => {
      currentJob = null;
      lastExitCode = -1;
      reject(error);
    });

    child.on('close', (code) => {
      currentJob = null;
      lastExitCode = code;
      if (code === 0) {
        resolve({ code, output: lastOutput });
      } else {
        reject(new Error(lastOutput || `${label} failed with exit code ${code}`));
      }
    });
  });
}

function runStart(mode, expose) {
  const safeMode = mode === 'plain' ? 'plain' : 'vpn';
  const safeExpose = expose === 'caddy' ? 'caddy' : 'funnel';
  const command = `${shellQuote(START_SCRIPT)} ${shellQuote(safeMode)} ${shellQuote(safeExpose)}`;
  return runCommand(`start:${safeMode}:${safeExpose}`, command);
}

function runStop() {
  return runCommand('stop', shellQuote(STOP_SCRIPT));
}

function respond(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload, null, 2));
}

function requestHandler(req, res) {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const remoteAddress = req.socket.remoteAddress || '';

  if (!isPrivateAddress(remoteAddress)) {
    respond(res, 403, { ok: false, error: 'forbidden', detail: 'Only private LAN clients are allowed.' });
    return;
  }

  if (!hasValidToken(reqUrl, req.headers)) {
    respond(res, 401, { ok: false, error: 'unauthorized', detail: 'Missing or invalid control token.' });
    return;
  }

  if (reqUrl.pathname === '/') {
    respond(res, 200, {
      ok: true,
      service: 'selfstream-control',
      bind: HOST,
      port: PORT,
      defaultMode: DEFAULT_MODE,
      defaultExpose: DEFAULT_EXPOSE,
      endpoints: {
        start: '/start?mode=vpn|plain&expose=funnel|caddy',
        stop: '/stop',
        status: '/status',
      },
    });
    return;
  }

  if (reqUrl.pathname === '/status') {
    respond(res, 200, {
      ok: true,
      running: Boolean(currentJob),
      currentJob: currentJob ? currentJob.label : null,
      lastAction,
      lastExitCode,
      lastOutput,
    });
    return;
  }

  if (req.method !== 'GET') {
    respond(res, 405, { ok: false, error: 'method_not_allowed' });
    return;
  }

  if (reqUrl.pathname === '/start') {
    const mode = reqUrl.searchParams.get('mode') || DEFAULT_MODE;
    const expose = reqUrl.searchParams.get('expose') || DEFAULT_EXPOSE;
    runStart(mode, expose)
      .then(({ output }) => {
        respond(res, 200, { ok: true, action: 'start', mode, expose, output });
      })
      .catch((error) => {
        respond(res, 500, { ok: false, action: 'start', error: error.message, output: lastOutput });
      });
    return;
  }

  if (reqUrl.pathname === '/stop') {
    runStop()
      .then(({ output }) => {
        respond(res, 200, { ok: true, action: 'stop', output });
      })
      .catch((error) => {
        respond(res, 500, { ok: false, action: 'stop', error: error.message, output: lastOutput });
      });
    return;
  }

  respond(res, 404, { ok: false, error: 'not_found' });
}

const server = http.createServer(requestHandler);

server.listen(PORT, HOST, () => {
  console.log(`SelfStream control server listening on http://${HOST}:${PORT}`);
});
