/* eslint-disable no-restricted-globals */
// imageTracer.worker.js
// Runs in a Web Worker. Receives an ImageBitmap (resized) and parameters and returns simplified contours.
self.onmessage = async function(e) {
  const msg = e.data;
  if (!msg || msg.type !== 'trace') return;
  const id = msg.id;
  try {
    const { sw, sh, threshold = 128, step = 2, simplify = 1.75 } = msg;
    const bitmap = msg.bitmap;
    const off = new OffscreenCanvas(sw, sh);
    const ctx = off.getContext('2d');
    ctx.clearRect(0,0,sw,sh);
    ctx.drawImage(bitmap, 0, 0, sw, sh);
    const imgd = ctx.getImageData(0,0,sw,sh).data;
    // build mask
    const mask = new Uint8Array(sw*sh);
    for (let i=0, p=0; i<imgd.length; i+=4, p++) mask[p] = (imgd[i+3] >= threshold) ? 1 : 0;

    // fast marching-style contour tracing
    const inside = (x,y)=> x>=0 && y>=0 && x<sw && y<sh && mask[y*sw + x];
    const seen = new Uint8Array(sw*sh);
    const contours = [];
    const TIME_BUDGET = 400; const start = Date.now();
    const stepN = Math.max(1, step);
    for (let y=0; y<sh; y+=stepN) {
      if (Date.now()-start > TIME_BUDGET) break;
      for (let x=0; x<sw; x+=stepN) {
        if (Date.now()-start > TIME_BUDGET) break;
        const idx = y*sw + x;
        if (!inside(x,y) || seen[idx]) continue;
        let cx = x, cy = y, dir = 0; // 0:E,1:S,2:W,3:N
        const poly = [];
        let guard = 0;
        do {
          if (++guard > sw*sh*2) break;
          seen[Math.max(0, Math.min(sh-1, cy))*sw + Math.max(0, Math.min(sw-1, cx))] = 1;
          poly.push({ x: cx, y: cy });
          const leftDir = (dir + 3) & 3;
          const fw = dir===0? [stepN,0] : dir===1? [0,stepN] : dir===2? [-stepN,0] : [0,-stepN];
          const lf = leftDir===0? [stepN,0] : leftDir===1? [0,stepN] : leftDir===2? [-stepN,0] : [0,-stepN];
          const lx = Math.max(0, Math.min(cx+lf[0], sw-1));
          const ly = Math.max(0, Math.min(cy+lf[1], sh-1));
          const fx = Math.max(0, Math.min(cx+fw[0], sw-1));
          const fy = Math.max(0, Math.min(cy+fw[1], sh-1));
          if (inside(lx,ly)) dir = leftDir;
          else if (!inside(fx,fy)) dir = (dir+1)&3;
          else { cx = fx; cy = fy; }
        } while (!(Math.abs(cx-x)<=stepN && Math.abs(cy-y)<=stepN && dir===0));
        if (poly.length > 6) contours.push(poly);
      }
    }

    // Douglas-Peucker simplifier
    function simplifyDP(points, tol) {
      if (!points || points.length < 3) return points.slice();
      const sq = (a)=>a*a;
      function segDistSq(p, a, b) {
        const x = a.x, y = a.y, dx = b.x - x, dy = b.y - y;
        if (dx === 0 && dy === 0) return sq(p.x-x)+sq(p.y-y);
        let t = ((p.x-x)*dx + (p.y-y)*dy) / (dx*dx + dy*dy);
        t = Math.max(0, Math.min(1, t));
        const cx = x + t*dx, cy = y + t*dy;
        return sq(p.x-cx) + sq(p.y-cy);
      }
      const tolSq = tol*tol;
      const out = [];
      const stack = [[0, points.length-1]];
      const keep = new Uint8Array(points.length);
      keep[0]=1; keep[points.length-1]=1;
      while (stack.length) {
        const [i,j] = stack.pop();
        let maxD = 0, maxi = -1;
        for (let k=i+1;k<j;k++) {
          const d = segDistSq(points[k], points[i], points[j]);
          if (d > maxD) { maxD=d; maxi=k; }
        }
        if (maxi >= 0 && maxD > tolSq) { keep[maxi]=1; stack.push([i,maxi]); stack.push([maxi,j]); }
      }
      for (let i=0;i<points.length;i++) if (keep[i]) out.push(points[i]);
      return out;
    }

    const simplified = contours.map(p => simplifyDP(p, simplify)).filter(p=>p.length>=3);
    // center polygons
    const centered = simplified.map(poly => poly.map(pt => ({ x: pt.x - sw/2, y: pt.y - sh/2 }))) ;
    self.postMessage({ id, contours: centered });
  } catch (err) {
    self.postMessage({ id, error: (err && err.message) || String(err) });
  }
};
