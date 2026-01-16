const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const FormData = require('form-data');
const child = require('child_process');

async function postUpload(filePath, prompt, opts = {}) {
  const url = 'http://127.0.0.1:5002/api/edit-image-upload';
  const form = new FormData();
  form.append('prompt', prompt);
  form.append('silhouette', 'false');
  form.append('autoMask', 'true');
  if (opts.maskInvert) form.append('maskInvert', 'true');
  if (opts.maskTighten) form.append('maskTighten', 'true');
  form.append('image', fs.createReadStream(filePath));
  const res = await fetch(url, { method: 'POST', body: form, headers: form.getHeaders() });
  const j = await res.json();
  return j;
}

async function downloadTo(tempUrl) {
  const r = await fetch(tempUrl);
  if (!r.ok) throw new Error('download failed: ' + r.status);
  const buf = await r.buffer();
  const outName = `about-${Date.now()}-${Math.random().toString(36).slice(2,8)}.png`;
  const outDir = path.resolve(__dirname, '..', 'public', 'generated');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, outName);
  fs.writeFileSync(outPath, buf);
  return outPath;
}

function runDiff(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const cmd = `node "${path.resolve(__dirname, 'imageDiff.js')}" "${inputPath}" "${outputPath}"`;
    child.exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
      if (err) return reject({ err, stdout, stderr });
      try { const j = JSON.parse(stdout); resolve(j); } catch (e) { resolve({ raw: stdout }); }
    });
  });
}

async function run() {
  const input = path.resolve(__dirname, '..', 'public', 'generated', 'generated-1757407267463-ilga33f.png');
  if (!fs.existsSync(input)) {
    console.error('Input file for AB runner not found:', input); process.exit(2);
  }
  const prompts = [
    'Replace the monkeys in this image with snakes; keep all colors, lighting, and the background unchanged.',
    'Edit the uploaded image: only replace the monkeys with snakes. Do not alter the background, camera, lighting, or composition.',
    'Strict edit: replace only the animals with snakes and preserve every other pixel of the image exactly.'
  ];
  const combos = [];
  for (const maskInvert of [false, true]) for (const maskTighten of [false, true]) combos.push({ maskInvert, maskTighten });

  const results = [];
  for (const p of prompts) {
    for (const c of combos) {
      console.log('Running test for prompt variant and mask opts:', p.slice(0,60), c);
      let res;
      try {
        res = await postUpload(input, p, c);
      } catch (e) {
        console.error('Upload request failed', e); results.push({ prompt: p, opts: c, error: String(e) }); continue;
      }
      // server returns url or imageBase64
      let outPath = null;
      if (res && res.url) {
        try { outPath = await downloadTo(path.resolve(__dirname, '..', res.url.replace(/^\//, ''))); } catch (dErr) { console.warn('Failed to download returned url', dErr); }
      } else if (res && res.imageBase64) {
        const outDir = path.resolve(__dirname, '..', 'public', 'generated'); fs.mkdirSync(outDir, { recursive: true });
        const filename = `about-${Date.now()}-${Math.random().toString(36).slice(2,8)}.png`;
        outPath = path.join(outDir, filename);
        fs.writeFileSync(outPath, Buffer.from(res.imageBase64, 'base64'));
      }
      if (!outPath) { results.push({ prompt: p, opts: c, response: res, error: 'no output path' }); continue; }
      let diff;
      try { diff = await runDiff(input, outPath); } catch (diffErr) { diff = { error: String(diffErr) }; }
      results.push({ prompt: p, opts: c, response: res, outPath, diff });
    }
  }
  const out = path.resolve(__dirname, '..', 'public', 'generated', `ab_results_${Date.now()}.json`);
  fs.writeFileSync(out, JSON.stringify(results, null, 2));
  console.log('Wrote AB results to', out);
}

if (require.main === module) run().catch((e)=>{ console.error('AB runner error', e); process.exit(1); });
