import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 4176;
const CHROME_DEBUG_PORT = 9225;
const CHROME_BIN = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CWD = process.cwd();
const OUTDIR = path.resolve(CWD, 'screenshots-canyon-mist');
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json'
};
if (!fs.existsSync(OUTDIR)) fs.mkdirSync(OUTDIR, { recursive: true });

function startServer() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let rawPath = req.url.split('?')[0];
      if (rawPath === '/') rawPath = '/story/index.html';
      const filePath = path.join(CWD, rawPath);
      const ext = path.extname(filePath).toLowerCase();
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.writeHead(200, {'Content-Type': MIME_TYPES[ext]||'application/octet-stream','Access-Control-Allow-Origin':'*'});
        fs.createReadStream(filePath).pipe(res);
      } else { res.writeHead(404); res.end('Not found'); }
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}
function getJson(url) {
  return new Promise((resolve,reject) => {
    http.get(url, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>{try{resolve(JSON.parse(d))}catch(e){reject(e)}}); }).on('error',reject);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  const server = await startServer();
  const tmpDir = fs.mkdtempSync('/tmp/chrome-canyon-');
  const ch = spawn(CHROME_BIN, [
    '--headless=new', '--remote-debugging-port='+CHROME_DEBUG_PORT,
    '--user-data-dir='+tmpDir, '--enable-webgl', '--ignore-gpu-blocklist',
    '--use-gl=angle', '--use-angle=metal', '--no-sandbox',
    '--window-size=1440,900', 'http://127.0.0.1:'+PORT+'/story/index.html'
  ], {stdio:'ignore'});

  let targets = null;
  for (let i=0;i<30;i++) { await sleep(200); try { targets=await getJson('http://127.0.0.1:'+CHROME_DEBUG_PORT+'/json'); if(targets&&targets.length>0)break; } catch(_){} }
  const t = targets.find(t=>t.type==='page')||targets[0];
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let rid=1; const pending=new Map();
  function sendCmd(m,p={}) { return new Promise((res,rej)=>{ const id=rid++; pending.set(id,{resolve:res,reject:rej}); ws.send(JSON.stringify({id,method:m,params:p})); }); }
  await new Promise(r=>{ws.onopen=r});
  ws.onmessage = e => { const m=JSON.parse(e.data); if(m.id&&pending.has(m.id)){const{resolve:res,reject:rej}=pending.get(m.id);pending.delete(m.id);m.error?rej(m.error):res(m.result);} };
  await sendCmd('Runtime.enable'); await sendCmd('Page.enable');

  for (let i=0;i<100;i++) {
    await sleep(350);
    try { const r=await sendCmd('Runtime.evaluate',{expression:'!!window.__STORY_STATE__&&window.__STORY_STATE__.cameraLoaded',returnByValue:true}); if(r?.result?.value===true){console.log('Scene loaded');break;} } catch(_){}
  }

  const mist = await sendCmd('Runtime.evaluate',{expression:'JSON.stringify(window.__STORY_STATE__?.getAltarMistState?.()||{})',returnByValue:true});
  console.log('Mist state:', mist?.result?.value);

  async function shot(name, pct) {
    await sendCmd('Runtime.evaluate',{expression:`window.__STORY_STATE__.setScrollProgress(${pct});`});
    await sleep(700);
    const r = await sendCmd('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(path.join(OUTDIR,name), Buffer.from(r.data,'base64'));
    console.log('Saved:', name);
  }

  await shot('60pct.png', 0.60);
  await shot('65pct.png', 0.65);
  await shot('70pct.png', 0.70);
  await shot('75pct.png', 0.75);
  await shot('80pct.png', 0.80);

  await sendCmd('Runtime.evaluate',{expression:`(()=>{const s=window.__STORY_STATE__.getScene();s.traverse(o=>{if(o.name==='CanyonMistCluster')o.visible=false;});})();`});
  await shot('70pct_NO_CLUSTER.png', 0.70);

  ws.close(); ch.kill(); server.close();
  console.log('Done →', OUTDIR);
  process.exit(0);
}
run().catch(console.error);
