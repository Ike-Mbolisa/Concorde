// Thermal expansion and skin temperature visualizer
// This function simulates the skin temperature and thermal expansion of the Concorde's fuselage as it approaches and exceeds Mach 2, using a canvas visualization.
// The skin temperature is calculated based on a simplified model of aerodynamic heating, and the expansion is shown as an increase in the width of the plane's silhouette.
// The user can adjust the Mach number with a slider to see how these factors change in real time.

// Termisk udvidelse og hudtemperatur visualizer
// Denne funktion simulerer hudtemperaturen og den termiske udvidelse af Concordes fuselage, når den nærmer sig og overskrider Mach 2, ved hjælp af en canvas-visualisering.
// Hudtemperaturen beregnes baseret på en forenklet model af aerodynamisk opvarmning, og udvidelsen vises som en stigning i bredden af flyets silhuet.
// Brugeren kan justere Mach-nummeret med en slider for at se, hvordan disse faktorer ændrer sig i realtid.
(function () {
  const canvas  = document.getElementById('heatCanvas');
  const ctx     = canvas.getContext('2d');
  const slider  = document.getElementById('heatSlider');
  const readout = document.getElementById('heatReadout');
  const badge   = document.getElementById('heatInfo');

  // Language strings from data attributes, same approach as mach-cone.js.
  // Sprogtekster fra data-attributter, samme tilgang som mach-cone.js.
  const labels = {
    coldLength:  canvas.dataset.coldLabel   || 'Cold length (ground)',
    tempLabel:   canvas.dataset.tempLabel   || 'fuselage skin temperature',
    badgePrefix: canvas.dataset.badgePrefix || 'Skin temp',
    expLabel:    canvas.dataset.expLabel    || 'Expansion',
  };

  // Scale canvas for high-DPI screens.
  // Skalerer canvas til høj-DPI skaerme.
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = 500 * dpr; canvas.height = 300 * dpr;
  canvas.style.width = '100%'; canvas.style.height = 'auto';
  ctx.scale(dpr, dpr);
  const W = 500, H = 300;

  const T_AMB_GROUND = 288.15; // Kelvin, ISA sea-level standard temperature

  // Simplified stagnation temperature recovery formula.
  // Temperature rises with mach squared — at Mach 2.04 this reaches ~127 °C, matching the real aircraft.
  // Forenklet stagnationstemperatur-formel.
  // Temperaturen stiger med mach i anden - ved Mach 2.04 nar den ca. 127 °C, svarende til det rigtige fly.
  function skinTemp(mach) {
    const T_base = mach < 0.5 ? T_AMB_GROUND : T_AMB_GROUND - mach * 35;
    return T_base * (1 + 0.2 * 0.9 * mach * mach) - 273.15;
  }

  // Expansion is quadratic in mach because it scales with temperature, which scales with mach squared.
  // At Mach 2.04 the real Concorde expanded by ~250 mm.
  // Udvidelsen er kvadratisk i mach fordi den skalerer med temperaturen, som skalerer med mach i anden.
  // Ved Mach 2.04 udvidede den rigtige Concorde sig med ca. 250 mm.
  function expansion_mm(mach) {
    return (mach / 2.04) * (mach / 2.04) * 250;
  }

  // Maps a temperature in °C to an RGB colour: blue (cold) -> yellow (warm) -> red (hot).
  // Mapper en temperatur i °C til en RGB-farve: blå (kold) -> gul (varm) -> rød (hed).
  function tempColor(t) {
    const pct = Math.max(0, Math.min(1, (t - 10) / 120));
    if (pct < 0.5) {
      const r = Math.round(pct * 2 * 200);
      const g = Math.round(100 + pct * 2 * 100);
      const b = Math.round(255 - pct * 2 * 200);
      return `rgb(${r},${g},${b})`;
    } else {
      const p2 = (pct - 0.5) * 2;
      const r = Math.round(200 + p2 * 55);
      const g = Math.round(200 - p2 * 160);
      const b = Math.round(55 - p2 * 55);
      return `rgb(${r},${g},${b})`;
    }
  }

  let currentMach = 0;
  let animMach = 0;   // lerped toward currentMach each frame for smooth easing
  let maskCanvas = null;

  // Load the silhouette PNG and strip its white background by setting any near-white
  // pixel's alpha to 0. The result is used as a mask in the drawing step below.
  // Indlaes silhuet-PNG og fjern den hvide baggrund ved at saette alfa til 0 for naesten
  // hvide pixels. Resultatet bruges som maske i tegnetrinnet nedenfor.
  const img = new Image();
  img.src = 'Concorde Silh.png';
  img.onload = () => {
    maskCanvas = document.createElement('canvas');
    maskCanvas.width = img.width;
    maskCanvas.height = img.height;
    const mctx = maskCanvas.getContext('2d');
    mctx.drawImage(img, 0, 0);
    const id = mctx.getImageData(0, 0, img.width, img.height);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200) d[i + 3] = 0;
    }
    mctx.putImageData(id, 0, 0);
    requestAnimationFrame(draw);
  };

  // Reusable offscreen canvas — draw the heat gradient here, then mask it with the silhouette.
  // Genanvendelig offscreen canvas — tegn varmegradienten her, og masker den derefter med silhuetten.
  const tmp = document.createElement('canvas');
  const tctx = tmp.getContext('2d');

  function draw() {
    // Lerp animMach toward currentMach — 5% of the gap per frame gives a smooth ease-in.
    // Lerp animMach mod currentMach — 5% af forskellen pr. frame giver en javn ease-in.
    animMach += (currentMach - animMach) * 0.05;
    const m = animMach;

    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0a0c14'); bg.addColorStop(1, '#0f1220');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // Wait for the mask to finish loading before drawing the plane.
    // Vent pa at masken er færdigindlæst inden flyet tegnes.
    if (!maskCanvas) { requestAnimationFrame(draw); return; }

    const temp = skinTemp(m);
    const expMm = expansion_mm(m);
    const expPx = (expMm / 250) * 30; // scale real mm to canvas pixels

    // The plane image stretches horizontally as temperature rises.
    // Flyets billede straekkr sig vandret i takt med at temperaturen stiger.
    const BASE_W = 440;
    const aspect = maskCanvas.height / maskCanvas.width;
    const imgW = BASE_W + expPx;
    const imgH = BASE_W * aspect;
    const imgX = (W - BASE_W) / 2 - expPx / 2; // keep centred as it grows
    const imgY = H / 2 - imgH / 2 - 15;

    // Dashed reference line showing the cold (ground) length for comparison.
    // Stiplet referencelinje der viser den kolde (jordaens) laengde til sammenligning.
    const coldMid = W / 2;
    const lineY = imgY + imgH + 14;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(122,122,154,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(coldMid - BASE_W / 2, lineY);
    ctx.lineTo(coldMid + BASE_W / 2, lineY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(122,122,154,0.45)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(labels.coldLength, coldMid, lineY + 13);
    ctx.textAlign = 'left';

    // Bracket with arrowheads showing the hot (expanded) length and the difference in mm.
    // Klammer med pilespidser der viser den varme (udvidede) laengde og forskellen i mm.
    if (expPx > 1) {
      const bracketY = lineY - 6;
      ctx.strokeStyle = 'rgba(200,169,110,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(imgX, bracketY);
      ctx.lineTo(imgX + imgW, bracketY);
      ctx.stroke();
      [[imgX, 1], [imgX + imgW, -1]].forEach(([x, dir]) => {
        ctx.beginPath();
        ctx.moveTo(x, bracketY);
        ctx.lineTo(x + dir * 6, bracketY - 4);
        ctx.lineTo(x + dir * 6, bracketY + 4);
        ctx.fillStyle = 'rgba(200,169,110,0.6)';
        ctx.fill();
      });
      ctx.fillStyle = 'rgba(200,169,110,0.9)';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`+${expMm.toFixed(0)} mm`, coldMid, bracketY - 3);
      ctx.textAlign = 'left';
    }

    // Draw heat gradient onto the offscreen canvas, then apply the silhouette as a mask
    // using destination-in compositing — only pixels where the mask is opaque survive.
    // Tegn varmegradienten pa offscreen canvas, og anvend derefter silhuetten som maske
    // ved hjaelp af destination-in compositing — kun pixels hvor masken er uigennemsigtig overlever.
    tmp.width  = Math.ceil(imgW);
    tmp.height = Math.ceil(imgH);
    const grad = tctx.createLinearGradient(0, 0, imgW, 0);
    grad.addColorStop(0,   tempColor(temp * 0.78));  // tail — slightly cooler
    grad.addColorStop(0.5, tempColor(temp * 0.95));  // mid fuselage
    grad.addColorStop(1,   tempColor(temp * 1.08));  // nose — hottest point
    tctx.fillStyle = grad;
    tctx.fillRect(0, 0, imgW, imgH);
    tctx.globalCompositeOperation = 'destination-in';
    tctx.drawImage(maskCanvas, 0, 0, imgW, imgH);
    tctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(tmp, imgX, imgY);

    // Engine exhaust glow — intensity and colour shift with Mach number.
    // Motorudstødningsgløden — intensitet og farve aendres med Mach-nummeret.
    if (m > 0.2) {
      const glowX = imgX + imgW * 0.09;
      const glowY = imgY + imgH * 0.74;
      const glow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, 30);
      glow.addColorStop(0, `rgba(255,${Math.round(180 - m * 80)},30,${Math.min(0.9, m * 0.7)})`);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.ellipse(glowX - 12, glowY, 30, 11, 0, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();
    }

    // Temperature badge in the top-left corner — colour matches the heat gradient.
    // Temperatur-badge i øverste venstre hjørne — farven matcher varmegradienten.
    ctx.fillStyle = 'rgba(10,12,20,0.75)';
    ctx.beginPath();
    ctx.roundRect(10, 10, 178, 52, 6);
    ctx.fill();
    ctx.fillStyle = tempColor(temp);
    ctx.font = 'bold 15px monospace';
    ctx.fillText(`${temp.toFixed(0)} °C`, 20, 32);
    ctx.fillStyle = 'rgba(122,122,154,0.8)';
    ctx.font = '10px sans-serif';
    ctx.fillText(labels.tempLabel, 20, 50);

    requestAnimationFrame(draw);
  }

  // Update values and the info badge below the canvas when the slider moves.
  // Opdater vaerdier og info-badgen under canvas nar slideren bevaeges.
  slider.addEventListener('input', () => {
    currentMach = parseFloat(slider.value);
    readout.textContent = `Mach ${currentMach.toFixed(2)}`;
    const temp = skinTemp(currentMach);
    const exp  = expansion_mm(currentMach);
    badge.textContent = `${labels.badgePrefix}: ~${temp.toFixed(0)} °C  |  ${labels.expLabel}: +${exp.toFixed(0)} mm`;
  });
})();
