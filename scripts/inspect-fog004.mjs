import http from 'http';
import { spawn } from 'child_process';
import path from 'path';

async function inspect() {
  const wsMod = await import('ws');
  const WebSocket = wsMod.default;

  const versionRes = await fetch('http://127.0.0.1:9222/json/version');
  const versionData = await versionRes.json();
  const listRes = await fetch('http://127.0.0.1:9222/json/list');
  const pages = await listRes.json();
  const target = pages.find(p => p.url.includes('story')) || pages[0];
  if (!target) {
    console.log('No active page');
    return;
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(res => ws.on('open', res));

  let reqId = 1;
  function sendCmd(method, params = {}) {
    return new Promise((resolve) => {
      const id = reqId++;
      const handler = (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.id === id) {
          ws.off('message', handler);
          resolve(msg.result);
        }
      };
      ws.on('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  const evalRes = await sendCmd('Runtime.evaluate', {
    expression: `
      (() => {
        let found = null;
        let allFogs = [];
        window.__STORY_STATE__.getAllObjects('FOG').forEach(o => {
          allFogs.push(o);
        });
        const meshes = [];
        // traverse scene to find FOG004
        return {
          allFogs
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Result:', JSON.stringify(evalRes.result.value, null, 2));
  ws.close();
}
inspect().catch(console.error);
