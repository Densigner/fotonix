const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const FormData = require('form-data');

const app = require('./openaiImageProxy');

async function doPost(filePath, prompt) {
  const url = 'http://127.0.0.1:5002/api/edit-image-upload';
  const form = new FormData();
  form.append('prompt', prompt);
  // We want the whole image recolored, so don't request autoMask
  form.append('silhouette', 'false');
  form.append('image', fs.createReadStream(filePath));
  const res = await fetch(url, { method: 'POST', body: form, headers: form.getHeaders(), timeout: 120000 });
  return res.json();
}

function resolveReturnedUrl(resUrl) {
  if (!resUrl) return null;
  if (/^https?:\/\//i.test(resUrl)) return { type: 'absolute', url: resUrl };
  // treat as app-relative path like '/generated/xxx.png'
  return { type: 'local', path: path.resolve(__dirname, '..', resUrl.replace(/^\//, '')) };
}

async function run() {
  const port = 5002;
  const server = app.listen(port, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  console.log('In-process server listening on 127.0.0.1:' + port);

  try {
    const input = path.resolve(__dirname, '..', 'public', 'generated', 'generated-1757407267463-ilga33f.png');
    if (!fs.existsSync(input)) {
      console.error('Input not found:', input);
      server.close();
      process.exit(2);
    }

    const prompt = 'Make the entire uploaded image green while preserving lighting and details; shift colors to green tones but keep composition and shading.';
    console.log('Posting prompt:', prompt);

    let resJson;
    try {
      resJson = await doPost(input, prompt);
    } catch (e) {
      console.error('Upload request failed', e);
      server.close();
      process.exit(1);
    }

    let savedPath = null;
    if (resJson && resJson.url) {
      const parsed = resolveReturnedUrl(resJson.url);
      if (!parsed) {
        console.warn('Returned url is empty');
      } else if (parsed.type === 'absolute') {
        // download
        const r = await fetch(parsed.url);
        if (!r.ok) throw new Error('download failed: ' + r.status);
        const buf = await r.buffer();
        const outName = `green-${Date.now()}-${Math.random().toString(36).slice(2,8)}.png`;
        const outDir = path.resolve(__dirname, '..', 'public', 'generated'); fs.mkdirSync(outDir, { recursive: true });
        savedPath = path.join(outDir, outName);
        fs.writeFileSync(savedPath, buf);
      } else if (parsed.type === 'local') {
        if (fs.existsSync(parsed.path)) savedPath = parsed.path;
        else console.warn('Returned local path not found on disk:', parsed.path);
      }
    } else if (resJson && resJson.imageBase64) {
      const outDir = path.resolve(__dirname, '..', 'public', 'generated'); fs.mkdirSync(outDir, { recursive: true });
      const filename = `green-${Date.now()}-${Math.random().toString(36).slice(2,8)}.png`;
      savedPath = path.join(outDir, filename);
      fs.writeFileSync(savedPath, Buffer.from(resJson.imageBase64, 'base64'));
    }

    if (!savedPath) {
      console.error('No output saved. Server response:', JSON.stringify(resJson, null, 2));
      server.close();
      process.exit(1);
    }

    console.log('Saved output to', savedPath);
    try {
      const sharp = require('sharp');
      const m = await sharp(savedPath).metadata();
      console.log('Output metadata:', { width: m.width, height: m.height });
    } catch (metaErr) {
      console.warn('Failed to read output metadata', metaErr && metaErr.message);
    }

    server.close();
  } catch (err) {
    console.error('run error', err);
    server.close();
    process.exit(1);
  }
}

if (require.main === module) run();
