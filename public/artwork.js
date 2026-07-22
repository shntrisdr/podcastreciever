window.generateArtwork = async function(canvas, imageUrl, fallbackTitle) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  // Clear and fill background
  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, width, height);

  // Helper for hash fallback
  const getHash = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return hash;
  };

  const drawFallback = (title) => {
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.7;

    const hash = Math.abs(getHash(title || ''));
    const numShapes = 3 + (hash % 3); // 3 to 5 shapes

    // Seeded random
    let seed = hash;
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    for (let i = 0; i < numShapes; i++) {
      const isEllipse = random() > 0.5;
      const x = random() * width;
      const y = random() * height;
      const rx = 30 + random() * (width / 2);
      const ry = 30 + random() * (height / 2);
      const r = Math.floor(random() * 255);
      const g = Math.floor(random() * 255);
      const b = Math.floor(random() * 255);

      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.beginPath();
      if (isEllipse) {
        ctx.ellipse(x, y, rx, ry, random() * Math.PI, 0, Math.PI * 2);
      } else {
        ctx.arc(x, y, rx, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    // reset
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;
  };

  if (!imageUrl) {
    drawFallback(fallbackTitle);
    return;
  }

  const loadAndExtractImage = () => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const offscreen = document.createElement('canvas');
        offscreen.width = 32;
        offscreen.height = 32;
        const offCtx = offscreen.getContext('2d');
        offCtx.drawImage(img, 0, 0, 32, 32);
        try {
          const imageData = offCtx.getImageData(0, 0, 32, 32);
          resolve(imageData);
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = (e) => reject(new Error('Image load failed'));
      img.src = imageUrl;
    });
  };

  try {
    const imageData = await loadAndExtractImage();
    const data = imageData.data;

    // Convert to array of pixels [R, G, B, x, y]
    const pixels = [];
    for (let i = 0; i < data.length; i += 4) {
      // Ignore very transparent pixels
      if (data[i + 3] < 128) continue;
      const pixelIndex = i / 4;
      const x = pixelIndex % 32;
      const y = Math.floor(pixelIndex / 32);
      pixels.push({
        r: data[i],
        g: data[i+1],
        b: data[i+2],
        x: x,
        y: y
      });
    }

    if (pixels.length === 0) {
      drawFallback(fallbackTitle);
      return;
    }

    // K-Means clustering (k=4)
    const k = Math.min(4, pixels.length);
    let centroids = [];

    // Initialize centroids randomly from pixels
    for (let i = 0; i < k; i++) {
      const p = pixels[Math.floor(Math.random() * pixels.length)];
      centroids.push({ r: p.r, g: p.g, b: p.b });
    }

    const maxIterations = 10;
    let clusters = Array.from({ length: k }, () => []);

    for (let iter = 0; iter < maxIterations; iter++) {
      clusters = Array.from({ length: k }, () => []);

      // Assign pixels to closest centroid (using RGB space)
      for (const p of pixels) {
        let minDist = Infinity;
        let bestCluster = 0;
        for (let i = 0; i < k; i++) {
          const c = centroids[i];
          const distSq = (p.r - c.r)**2 + (p.g - c.g)**2 + (p.b - c.b)**2;
          if (distSq < minDist) {
            minDist = distSq;
            bestCluster = i;
          }
        }
        clusters[bestCluster].push(p);
      }

      // Update centroids
      let changed = false;
      for (let i = 0; i < k; i++) {
        if (clusters[i].length === 0) continue;
        let sumR = 0, sumG = 0, sumB = 0;
        for (const p of clusters[i]) {
          sumR += p.r;
          sumG += p.g;
          sumB += p.b;
        }
        const newR = sumR / clusters[i].length;
        const newG = sumG / clusters[i].length;
        const newB = sumB / clusters[i].length;

        // Check if changed significantly
        if (Math.abs(newR - centroids[i].r) > 1 ||
            Math.abs(newG - centroids[i].g) > 1 ||
            Math.abs(newB - centroids[i].b) > 1) {
          changed = true;
        }

        centroids[i] = { r: newR, g: newG, b: newB };
      }

      if (!changed) break;
    }

    // Compute cluster stats
    const clusterStats = [];
    for (let i = 0; i < k; i++) {
      const cluster = clusters[i];
      if (cluster.length === 0) continue;

      let sumX = 0, sumY = 0;
      for (const p of cluster) {
        sumX += p.x;
        sumY += p.y;
      }
      const meanX = sumX / cluster.length;
      const meanY = sumY / cluster.length;

      let varX = 0, varY = 0;
      for (const p of cluster) {
        varX += (p.x - meanX) ** 2;
        varY += (p.y - meanY) ** 2;
      }
      varX /= cluster.length;
      varY /= cluster.length;

      clusterStats.push({
        centroid: centroids[i],
        size: cluster.length,
        meanX,
        meanY,
        varX,
        varY
      });
    }

    // Draw based on clusterStats
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.7;

    const scaleX = width / 32;
    const scaleY = height / 32;

    for (const stat of clusterStats) {
      const { centroid, size, meanX, meanY, varX, varY } = stat;

      const cx = meanX * scaleX;
      const cy = meanY * scaleY;

      // Base radius derived from cluster size relative to total pixels
      const baseArea = (size / pixels.length) * (width * height) * 0.8;
      const baseRadius = Math.sqrt(baseArea / Math.PI);

      ctx.fillStyle = `rgb(${Math.round(centroid.r)}, ${Math.round(centroid.g)}, ${Math.round(centroid.b)})`;
      ctx.beginPath();

      // If one variance is extremely large compared to the other, draw ellipse
      // Add a small epsilon to avoid division by zero
      const vx = varX + 0.1;
      const vy = varY + 0.1;

      if (vx > 2 * vy || vy > 2 * vx) {
        // Ellipse
        const ratio = Math.sqrt(vx / vy);
        let rx = baseRadius * ratio;
        let ry = baseRadius / ratio;

        // Cap extreme squishing
        rx = Math.max(10, Math.min(rx, width));
        ry = Math.max(10, Math.min(ry, height));

        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      } else {
        // Circle
        const r = Math.max(10, Math.min(baseRadius, width));
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
      }

      ctx.fill();
    }

    // reset context
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;
  } catch (error) {
    console.warn("Could not load artwork for neo-pixel generation, using fallback", error);
    drawFallback(fallbackTitle);
  }
};
