const FormData = require('form-data');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

(async function(){
  try {
    const inputPath = path.resolve(__dirname, '..', 'public', 'generated', 'generated-1757352595888-q1hc5fk.png');
    if (!fs.existsSync(inputPath)) {
      console.error('Input image not found at', inputPath);
      process.exit(2);
    }

    const prompts = [
      'Replace the monkeys in this image with snakes; keep all colors, lighting, and the background unchanged. Do not produce a silhouette.',
      'Replace the monkeys in this image with snakes. Preserve the exact background, lighting, shadows, camera angle, and colors; do not add or remove any background elements. Only modify the animals.',
      'Replace only the monkeys (foreground subjects) with snakes of similar size and pose. Preserve all background, lighting, colors, shadows, and camera perspective. Do not create silhouettes or alter the background.'
    ];

    const results = [];

    const host = process.env.EXPERIMENT_HOST || 'http://127.0.0.1:5002';

    for (const prompt of prompts) {
      for (const maskInvert of [false, true]) {
        for (const maskTighten of [false, true]) {
          console.log('\n=== Running experiment: promptVariant=' + (prompts.indexOf(prompt)+1) + ', maskInvert=' + maskInvert + ', maskTighten=' + maskTighten + ' ===');
          const form = new FormData();
          form.append('prompt', prompt);
          form.append('silhouette', 'false');
          form.append('autoMask', 'true');
          form.append('maskInvert', maskInvert ? 'true' : 'false');
          form.append('maskTighten', maskTighten ? 'true' : 'false');
          form.append('image', fs.createReadStream(inputPath), { filename: path.basename(inputPath), contentType: 'image/png' });

          const url = host + '/api/edit-image-upload';
          let resp = null;
          try {
            const r = await fetch(url, { method: 'POST', headers: form.getHeaders(), body: form });
            const text = await r.text();
            try { resp = JSON.parse(text); } catch (e) { resp = { rawText: text }; }
            console.log('Server status:', r.status, 'response keys:', Object.keys(resp));
          } catch (err) {
            console.error('Request failed:', err && err.message ? err.message : err);
            results.push({ promptIndex: prompts.indexOf(prompt)+1, maskInvert, maskTighten, error: String(err) });
            continue;
          }

          // If response contains url path to generated image, compute local path
          let outUrl = resp && resp.url;
          if (!outUrl && resp && resp.imageBase64) {
            // write local file from base64
            try {
              const genDir = path.resolve(process.cwd(), 'public', 'generated');
              if (!fs.existsSync(genDir)) fs.mkdirSync(genDir, { recursive: true });
              const filename = `generated-experiment-${Date.now()}-${Math.random().toString(36).slice(2,8)}.png`;
              const outPath = path.join(genDir, filename);
              fs.writeFileSync(outPath, Buffer.from(resp.imageBase64, 'base64'));
              outUrl = '/generated/' + filename;
              console.log('Wrote base64 output to', outPath);
            } catch (e) { console.error('Failed to write base64 output:', e); }
          }

          if (!outUrl) {
            console.warn('No output URL or imageBase64 in server response, saving raw response to results');
            results.push({ promptIndex: prompts.indexOf(prompt)+1, maskInvert, maskTighten, response: resp });
            continue;
          }

          const publicPath = outUrl.replace(/^\//, '');
          const outFull = path.resolve(process.cwd(), publicPath);
          if (!fs.existsSync(outFull)) {
            console.warn('Expected output file not found at', outFull, ' — server url:', outUrl);
            results.push({ promptIndex: prompts.indexOf(prompt)+1, maskInvert, maskTighten, url: outUrl, error: 'output_not_found' });
            continue;
          }

          // Run imageDiff
          try {
            const cmd = `node "${path.join(process.cwd(), 'server', 'imageDiff.js')}" "${inputPath}" "${outFull}"`;
            console.log('Running diff:', cmd);
            const out = execSync(cmd, { encoding: 'utf8' });
            let diffJson = null;
            try { diffJson = JSON.parse(out); } catch (e) { console.error('Failed to parse imageDiff output:', e); console.log('raw:', out); }
            results.push({ promptIndex: prompts.indexOf(prompt)+1, maskInvert, maskTighten, url: outUrl, diff: diffJson });
            console.log('Diff result:', diffJson && { diffPercent: diffJson.diffPercent, diffPath: diffJson.diffPath });
          } catch (dErr) {
            console.error('Diff failed:', dErr && dErr.message ? dErr.message : dErr);
            results.push({ promptIndex: prompts.indexOf(prompt)+1, maskInvert, maskTighten, url: outUrl, diffError: String(dErr) });
          }

          // short pause to avoid overwhelming server
          await sleep(1200);
        }
      }
    }

    const outFile = path.join(process.cwd(), 'server', `experiments-results-${Date.now()}.json`);
    fs.writeFileSync(outFile, JSON.stringify({ created: Date.now(), input: inputPath, results }, null, 2));
    console.log('\nWrote experiments summary to', outFile);
    console.log('Summary:');
    for (const r of results) {
      console.log(JSON.stringify({ promptIndex: r.promptIndex, maskInvert: r.maskInvert, maskTighten: r.maskTighten, diffPercent: r.diff && r.diff.diffPercent, diffPath: r.diff && r.diff.diffPath, url: r.url, error: r.error || r.diffError || (r.response && 'no_output') }, null, 2));
    }

    process.exit(0);
  } catch (err) {
    console.error('Experiment runner failed:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
