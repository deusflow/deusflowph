import http from 'http';
import fs from 'fs';
import path from 'path';

const CHROME_DEBUG_PORT = 9222;

async function queryChrome() {
  const jsonRes = await fetch(`http://127.0.0.1:${CHROME_DEBUG_PORT}/json`);
  const tabs = await jsonRes.json();
  const storyTab = tabs.find(t => t.url.includes('/story/'));
  if (!storyTab || !storyTab.webSocketDebuggerUrl) {
    console.error('No story tab found!');
    process.exit(1);
  }

  const ws = new WebSocket(storyTab.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let msgId = 1;
  function sendCmd(method, params = {}) {
    return new Promise((resolve) => {
      const id = msgId++;
      const onMsg = (evt) => {
        const data = JSON.parse(evt.data);
        if (data.id === id) {
          ws.removeEventListener('message', onMsg);
          resolve(data);
        }
      };
      ws.addEventListener('message', onMsg);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  const res = await sendCmd('Runtime.evaluate', {
    expression: `
      (() => {
        const results = [];
        const fogObjects = window.__STORY_STATE__.getAllObjects('fog');
        const fireObjects = window.__STORY_STATE__.getAllObjects('fire');
        return {
          fogObjects,
          fireObjects,
          cameraPos: window.__STORY_STATE__.getCameraPosition()
        };
      })()
    `,
    returnByValue: true
  });

  console.log(JSON.stringify(res.result.value, null, 2));
  ws.close();
}

queryChrome().catch(console.error);
