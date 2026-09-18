window.generateArtwork = function(canvas, imageUrl, fallbackTitle) {
  if (!canvas) return canvas;

  // havtone keeps its render loop running forever, tied to the canvas element
  // it was given. Swap in a fresh clone before each track so the previous
  // loop's dots stop landing on the currently visible canvas. Callers must
  // use the returned element from now on.
  const freshCanvas = canvas.cloneNode(false);
  canvas.replaceWith(freshCanvas);

  if (!imageUrl) {
    freshCanvas.classList.add('hidden');
    return freshCanvas;
  }

  freshCanvas.classList.remove('hidden');

  const proxiedUrl = `/api/fetch-image?url=${encodeURIComponent(imageUrl)}`;

  window.havtone({
    canvasId: freshCanvas.id,
    image: proxiedUrl,
    shape: 'circle',
    size: 8,
    minSize: 2,
    spacing: 8,
    rotation: 15,
    maxFPS: 12,
    animate: false,
    hoverEffect: false
  });

  return freshCanvas;
};
