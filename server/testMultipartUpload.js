const FormData = require('form-data');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

(async function(){
  try {
  // Use a generated image from public/generated as requested for repro
  const imgPath = path.resolve(__dirname, '..', 'public', 'generated', 'generated-1757352595888-q1hc5fk.png');
    if (!fs.existsSync(imgPath)) {
      console.error('Image not found at', imgPath);
      process.exit(2);
    }

  const form = new FormData();
  // Request a color-preserving edit: replace monkeys with snakes and keep all other visual properties unchanged
  form.append('prompt', 'Replace the monkeys in this image with snakes; keep all colors, lighting, and the background unchanged. Do not produce a silhouette.');
  // Explicitly request no silhouette from the proxy
  form.append('silhouette', 'false');
  // Request auto mask generation so the prompt can target the uploaded image's foreground
  form.append('autoMask', 'true');
    form.append('image', fs.createReadStream(imgPath), { filename: path.basename(imgPath), contentType: 'image/png' });

    console.log('Posting multipart to http://127.0.0.1:5002/api/edit-image-upload with file:', imgPath);
    const res = await fetch('http://127.0.0.1:5002/api/edit-image-upload', {
      method: 'POST',
      headers: form.getHeaders(),
      body: form
    });

    const status = res.status;
    const text = await res.text();
    console.log('Response status:', status);
    try {
      const j = JSON.parse(text);
      console.log('Response JSON:', JSON.stringify(j, null, 2));
    } catch (e) {
      console.log('Response text:', text.slice(0,2000));
    }
  } catch (err) {
    console.error('Request failed:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
