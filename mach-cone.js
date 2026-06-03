// Mach cone and sonic boom visualizer
// This function animates a plane flying across the canvas, emitting expanding pressure wavefronts.
// Once the plane exceeds Mach 1, a cone is drawn behind it at the correct Mach angle (u = arcsin(1/mach)).
// The user can adjust speed with a slider to see how the cone narrows at higher Mach numbers.

// Machkegle og sonisk boom visualizer
// Denne funktion animerer et fly, der flyver hen over canvas og udsender ekspanderende trykbølger.
// Nar flyet overskrider Mach 1, tegnes en kegle bag det med den korrekte Mach-vinkel (u = arcsin(1/mach)).
// Brugeren kan justere hastigheden med en slider for at se, hvordan keglen indsnævres ved højere Mach-tal.
(function () {
  const canvas  = document.getElementById('machCanvas');
  const ctx     = canvas.getContext('2d');
  const slider  = document.getElementById('machSlider');
  const readout = document.getElementById('machReadout');
  const badge   = document.getElementById('machInfo');

  // Language strings are read from data attributes on the canvas element in the HTML.
  // This allows the same script to serve both the English and Danish pages.
  // Sprogtekster laeses fra data-attributter pa canvas-elementet i HTML-filen.
  // Det giver det samme script mulighed for at betjene bade den engelske og danske side.
  const labels = {
    travel:     canvas.dataset.travelLabel    || 'direction of travel',
    subsonic:   canvas.dataset.subsonicText   || 'Subsonic - pressure waves travel ahead of the plane',
    transonic:  canvas.dataset.transonicText  || 'Transonic - shockwave forming, unstable drag rise',
    supersonic: canvas.dataset.supersonicText || 'Supersonic - Mach angle u = {mu} deg, sonic boom on the ground',
  };

  // Scale canvas for high-DPI (retina) screens so it stays sharp.
  // Skalerer canvas til høj-DPI (retina) skaerme sa det forbliver skarpt.
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = 500 * dpr; canvas.height = 300 * dpr;
  canvas.style.width = '100%'; canvas.style.height = 'auto';
  ctx.scale(dpr, dpr);
  const W = 500, H = 300;

  let mach = 0.5;
  let time = 0;
  let wavefronts = []; // each entry is { x, r } - spawn position and current radius
  let planeX = 80;
  const PLANE_SPEED_PX_S = 120; // visual pixels per second at Mach 1
  const SOUND_SPEED_PX_S = 120; // sound travels at the same visual rate, so Mach 1 = no cone
  let lastT = null;
  const MAX_WAVES = 30;

  // Add a new wavefront at the plane's current position.
  // Tilfojer en ny bølgefront ved flyets aktuelle position.
  function spawnWave() {
    wavefronts.push({ x: planeX, r: 0 });
  }

  function draw(ts) {
    if (!lastT) lastT = ts;
    const dt = Math.min((ts - lastT) / 1000, 0.05); // delta time in seconds, capped to avoid jump on tab focus
    lastT = ts;
    time += dt;

    // Move the plane. Reset and clear waves when it exits the right edge.
    // Flyt flyet. Nulstil og ryd bølger nar det forlader højre kant.
    const planeVPx = mach * PLANE_SPEED_PX_S;
    planeX += planeVPx * dt;
    if (planeX > W + 20) {
      planeX = -20;
      wavefronts = [];
    }

    // Spawn a wavefront roughly every 0.4 seconds of simulation time.
    // Spawn en bølgefront ca. hvert 0.4 sekund af simuleringstid.
    if (Math.floor(time * 2.5) > Math.floor((time - dt) * 2.5)) {
      if (wavefronts.length < MAX_WAVES) spawnWave();
    }

    // Grow all wavefront radii and cull any that are fully off-screen.
    // Udvid alle bølgefront-radier og fjern dem der er helt uden for skaermen.
    wavefronts.forEach(w => { w.r += SOUND_SPEED_PX_S * dt; });
    wavefronts = wavefronts.filter(w => w.r < W * 1.5 && w.x - w.r < W);

    ctx.clearRect(0, 0, W, H);

    // Dark background gradient.
    // Mørk baggrundsgradient.
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0a0c14');
    bg.addColorStop(1, '#0f1220');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Draw each pressure wavefront as a fading circle.
    // Tegn hver trykbølgefront som en aftagende cirkel.
    wavefronts.forEach(w => {
      const alpha = Math.max(0, 0.6 - w.r / (W * 0.8));
      ctx.beginPath();
      ctx.arc(w.x, H / 2, w.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(126,184,212,${alpha})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    });

    // Draw the Mach cone only when supersonic. The half-angle u = arcsin(1/mach) —
    // as mach increases, u decreases, so the cone narrows. This is the correct physics.
    // Tegn kun Mach-keglen nar flyet er supersonisk. Halvvinklen u = arcsin(1/mach) —
    // nar mach øges, mindskes u, sa keglen indsnævres. Det er den korrekte fysik.
    if (mach >= 1.0) {
      const sinMu = 1 / mach;
      const mu = Math.asin(Math.min(1, sinMu));
      const coneLen = W * 0.85;

      ctx.save();
      ctx.translate(planeX, H / 2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-coneLen, -Math.tan(mu) * coneLen);
      ctx.moveTo(0, 0);
      ctx.lineTo(-coneLen,  Math.tan(mu) * coneLen);
      ctx.strokeStyle = 'rgba(224,92,92,0.75)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      const angleDeg = (mu * 180 / Math.PI).toFixed(1);
      ctx.fillStyle = 'rgba(224,92,92,0.85)';
      ctx.font = '11px monospace';
      ctx.fillText(`u = ${angleDeg} deg`, -coneLen * 0.5, -Math.tan(mu) * coneLen * 0.5 - 6);
      ctx.restore();
    }

    // Draw the simplified plane shape (fuselage, nose, delta wing).
    // Tegn den forenklede flyform (fuselage, naese, deltavinge).
    ctx.save();
    ctx.translate(planeX, H / 2);
    ctx.fillStyle = '#e8e8f0';
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(22, 0); ctx.lineTo(36, 1); ctx.lineTo(22, 2);
    ctx.fillStyle = '#c8a96e'; ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(-16, -14); ctx.lineTo(-8, 0);
    ctx.fillStyle = 'rgba(200,169,110,0.7)'; ctx.fill();
    ctx.restore();

    ctx.fillStyle = 'rgba(122,122,154,0.7)';
    ctx.font = '11px sans-serif';
    ctx.fillText('<- ' + labels.travel, W - 190, 20);

    requestAnimationFrame(draw);
  }

  // Update mach value and badge text when the slider moves.
  // Opdater mach-vaerdi og badge-tekst nar slideren bevaeges.
  slider.addEventListener('input', () => {
    mach = parseFloat(slider.value);
    readout.textContent = `Mach ${mach.toFixed(2)}`;
    if (mach < 1.0) {
      badge.textContent = labels.subsonic;
      badge.style.background = 'rgba(126,184,212,0.1)';
      badge.style.borderColor = 'rgba(126,184,212,0.3)';
      badge.style.color = '#7eb8d4';
    } else if (mach < 1.2) {
      badge.textContent = labels.transonic;
      badge.style.background = 'rgba(200,169,110,0.1)';
      badge.style.borderColor = 'rgba(200,169,110,0.3)';
      badge.style.color = '#c8a96e';
    } else {
      const mu = (Math.asin(1 / mach) * 180 / Math.PI).toFixed(1);
      badge.textContent = labels.supersonic.replace('{mu}', mu);
      badge.style.background = 'rgba(224,92,92,0.1)';
      badge.style.borderColor = 'rgba(224,92,92,0.3)';
      badge.style.color = '#e05c5c';
    }
  });

  requestAnimationFrame(draw);
})();
