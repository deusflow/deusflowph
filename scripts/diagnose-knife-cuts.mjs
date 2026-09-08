import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 4175;
const CHROME_DEBUG_PORT = 9224;
const CHROME_BIN = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CWD = process.cwd();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json'
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let rawPath = req.url.split('?')[0];
      if (rawPath === '/') rawPath = '/story/index.html';
      if (rawPath.endsWith('/')) rawPath += 'index.html';

      const filePath = path.join(CWD, rawPath);
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const stat = fs.statSync(filePath);
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': stat.size,
          'Access-Control-Allow-Origin': '*'
        });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404);
        res.end('Not found: ' + rawPath);
      }
    });

    server.listen(PORT, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  const server = await startServer();
  const tempProfile = fs.mkdtempSync('/tmp/chrome-diag2-');
  const chromeProc = spawn(CHROME_BIN, [
    '--headless=new',
    `--remote-debugging-port=${CHROME_DEBUG_PORT}`,
    `--user-data-dir=${tempProfile}`,
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--use-gl=angle',
    '--use-angle=metal',
    '--enable-gpu-rasterization',
    '--no-sandbox',
    '--window-size=1280,800',
    `http://127.0.0.1:${PORT}/story/index.html`
  ], { stdio: 'ignore' });

  let targets = null;
  for (let i = 0; i < 30; i++) {
    await sleep(200);
    try {
      targets = await getJson(`http://127.0.0.1:${CHROME_DEBUG_PORT}/json`);
      if (targets && targets.length > 0) break;
    } catch (_e) {}
  }

  const pageTarget = targets.find(t => t.type === 'page') || targets[0];
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  let reqId = 1;
  const pending = new Map();

  function sendCmd(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = reqId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await new Promise((resolve) => { ws.onopen = resolve; });
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  };

  await sendCmd('Runtime.enable');
  await sendCmd('Page.enable');

  for (let i = 0; i < 80; i++) {
    await sleep(400);
    try {
      const res = await sendCmd('Runtime.evaluate', {
        expression: '!!window.__STORY_STATE__ && window.__STORY_STATE__.cameraLoaded',
        returnByValue: true
      });
      if (res?.result?.value === true) break;
    } catch (_e) {}
  }

  // Set camera to scroll 45% (where Image 2 was taken)
  await sendCmd('Runtime.evaluate', {
    expression: 'window.__STORY_STATE__.setScrollProgress(0.45);'
  });
  await sleep(300);

  async function takeShot(name) {
    const shotRes = await sendCmd('Page.captureScreenshot', { format: 'png' });
    const shotBuf = Buffer.from(shotRes.data, 'base64');
    fs.writeFileSync(path.resolve(name), shotBuf);
    console.log('Saved:', name);
  }

  // Print all mesh names in scene
  const allMeshesRes = await sendCmd('Runtime.evaluate', {
    expression: `
      (() => {
        const scene = window.__STORY_STATE__.getScene();
        const list = [];
        scene.traverse(o => {
          if (o.isMesh) list.push({ name: o.name, id: o.id, parent: o.parent?.name });
        });
        return list;
      })()
    `,
    returnByValue: true
  });
  console.log('Total meshes found:', allMeshesRes.result.value.length);
  console.log('Fog meshes:', allMeshesRes.result.value.filter(m => m.name.toLowerCase().includes('fog') || m.parent?.toLowerCase().includes('fog')));

  // Set camera to scroll 50%
  await sendCmd('Runtime.evaluate', {
    expression: 'window.__STORY_STATE__.setScrollProgress(0.50);'
  });
  await sleep(300);

  // Take baseline shot at 50%
  await takeShot('test_50_baseline.png');

  // Test hiding Bilboard.006, 016, 032
  await sendCmd('Runtime.evaluate', {
    expression: `
      (() => {
        const scene = window.__STORY_STATE__.getScene();
        scene.traverse(o => {
          if (o.name.includes('Bilboard.006') || o.name.includes('Bilboard.016') || o.name.includes('Bilboard.032')) {
            o.visible = false;
          }
        });
      })()
    `
  });
  await sleep(100);
  await takeShot('test_50_no_altar_billboards.png');

  // Test hiding FOG004
  await sendCmd('Runtime.evaluate', {
    expression: `
      (() => {
        const scene = window.__STORY_STATE__.getScene();
        scene.traverse(o => {
          if (o.name === 'FOG004' || o.name === 'FOG.004') o.visible = false;
        });
      })()
    `
  });
  await sleep(100);
  await takeShot('test_50_no_fog004.png');

  // Test hiding all fog
  await sendCmd('Runtime.evaluate', {
    expression: `
      (() => {
        const scene = window.__STORY_STATE__.getScene();
        scene.traverse(o => {
          if (o.name.startsWith('FOG')) o.visible = false;
        });
      })()
    `
  });
  await sleep(100);
  await takeShot('test_50_no_all_fog.png');

  ws.close();
  chromeProc.kill();
  server.close();
  process.exit(0);
}

run().catch(console.error);
