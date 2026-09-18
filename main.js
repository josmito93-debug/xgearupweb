import gsap from 'gsap';
import { FluidOrbInstance, MatrixOrbInstance } from './rare-ui.js';

// ===================================================================
// CONFIGURATION & CONSTANTS
// ===================================================================

const TOTAL_INTRO_FRAMES = 44; // frames 24 through 67
const START_FRAME = 24;
const END_FRAME = 67; // The user-marked frame: "desde aqui comienza el; lopp.jpg"
const FPS = 24;

const COLOR_VARIANTS = [
  { index: 0, name: "STEALTH CARBON", hex: "#5c6c39", id: "video-prod-0" },
  { index: 1, name: "CYBER EMERALD", hex: "#3b7a34", id: "video-prod-1" },
  { index: 2, name: "NEON MAGENTA", hex: "#f200a0", id: "video-prod-2" }
];

let activeVariantIndex = 0;
let loadedFrames = [];
let isIntroPlaying = false;
let isLoopLocked = false;
let matrixOrb = null;

// DOM Elements
const bgCanvas = document.getElementById('bg-canvas');
const bgCtx = bgCanvas.getContext('2d');
const bgVideo = document.getElementById('bg-video');
const printerLoader = document.getElementById('printer-loader');
const app = document.getElementById('app');

const printHead = document.getElementById('print-head');
const extruderAssembly = document.getElementById('extruder-assembly');
const laserScanline = document.getElementById('laser-scanline');
const logoPrinted = document.getElementById('logo-printed');
const logoGhost = document.getElementById('logo-ghost');

const hudPercent = document.getElementById('hud-percent');
const hudProgressFill = document.getElementById('hud-progress-fill');
const hudStatusText = document.getElementById('hud-status-text');
const layerVal = document.getElementById('layer-val');
const extruderTempVal = document.getElementById('extruder-temp');
const markerStatus = document.getElementById('marker-status');
const activeColorName = document.getElementById('active-color-name');
const btnReplay = document.getElementById('btn-replay');
const colorButtons = document.querySelectorAll('.color-btn');

const productVideos = [
  document.getElementById('video-prod-0'),
  document.getElementById('video-prod-1'),
  document.getElementById('video-prod-2')
];

// ===================================================================
// INITIALIZATION
// ===================================================================

async function init() {
  setupCanvasSize();
  window.addEventListener('resize', setupCanvasSize);

  // 1. Inject SVG Logo into the 3D Printer loader
  await loadAndInjectLogo();

  // 2. Preload JPG sequence (frames 024 -> 067)
  preloadJpgFrames();

  // 3. Setup Rare UI Components (FluidOrb & MatrixOrb)
  setupRareUI();

  // 4. Setup Video Synchronizers
  setupProductVideos();

  // 5. Run the 3D Printing Machine Loader
  runPrinterLoader();

  // 6. Setup UI Event Listeners
  setupEventListeners();

  // 7. Synchronize typography width (YOU CAN IMAGE OF == ANY-GEAR)
  syncTypographyWidth();
  window.addEventListener('resize', syncTypographyWidth);
  if (document.fonts) {
    document.fonts.ready.then(syncTypographyWidth);
  }
}

function syncTypographyWidth() {
  const anyGear = document.querySelector('.word-anygear');
  const titleGrift = document.querySelector('.title-grift');
  if (!anyGear || !titleGrift) return;

  const targetWidth = anyGear.getBoundingClientRect().width;
  if (targetWidth <= 0) return;

  titleGrift.style.width = `${targetWidth}px`;

  // Measure all individual letters across the 4 words
  const words = Array.from(titleGrift.querySelectorAll('.grift-word'));
  let totalLetterWidth = 0;
  words.forEach(w => {
    Array.from(w.children).forEach(ch => {
      totalLetterWidth += ch.getBoundingClientRect().width;
    });
  });

  const available = targetWidth - totalLetterWidth;
  if (available > 0) {
    // 9 letter gaps inside words, 3 word gaps between words
    // Word gap is 2.6x the letter gap so the 4 words are distinctly clear!
    const lg = Math.max(1, available / (9 + 3 * 2.6));
    const wg = lg * 2.6;

    titleGrift.style.columnGap = `${wg}px`;
    words.forEach(w => {
      w.style.columnGap = `${lg}px`;
    });
  }
}

function setupRareUI() {
  // Rare UI: Matrix Orb in Loader HUD
  const matrixOrbEl = document.getElementById('loader-matrix-orb');
  if (matrixOrbEl) {
    matrixOrb = new MatrixOrbInstance(matrixOrbEl, {
      size: 22,
      dots: 7,
      color: '#00f0ff',
      state: 'thinking'
    });
  }
}

// ===================================================================
// CANVAS SETUP & SIZING
// ===================================================================

function setupCanvasSize() {
  const dpr = window.devicePixelRatio || 1;
  bgCanvas.width = window.innerWidth * dpr;
  bgCanvas.height = window.innerHeight * dpr;
  bgCtx.scale(dpr, dpr);

  // Redraw current frame if available
  if (loadedFrames.length > 0 && currentRenderedFrame) {
    drawFrame(currentRenderedFrame);
  }
}

let currentRenderedFrame = null;

function drawFrame(img) {
  if (!img || !img.complete || img.naturalWidth === 0) return;
  currentRenderedFrame = img;

  const w = window.innerWidth;
  const h = window.innerHeight;
  const imgW = img.naturalWidth || 1920;
  const imgH = img.naturalHeight || 1080;

  // Cover algorithm (maintain aspect ratio)
  const scale = Math.max(w / imgW, h / imgH);
  const nw = imgW * scale;
  const nh = imgH * scale;
  const nx = (w - nw) / 2;
  const ny = (h - nh) / 2;

  bgCtx.clearRect(0, 0, w, h);
  bgCtx.drawImage(img, nx, ny, nw, nh);
}

// ===================================================================
// ASSET PRELOADING
// ===================================================================

async function loadAndInjectLogo() {
  try {
    const res = await fetch('/xgearup.svg');
    const svgText = await res.text();
    logoGhost.innerHTML = svgText;
    logoPrinted.innerHTML = svgText;
  } catch (err) {
    console.error('Failed to load SVG logo:', err);
  }
}

function preloadJpgFrames() {
  loadedFrames = [];
  for (let i = START_FRAME; i <= END_FRAME; i++) {
    const img = new Image();
    const frameNumber = String(i).padStart(3, '0');
    img.src = `/frames/frame-${frameNumber}.jpg`;
    loadedFrames.push(img);
  }
}

function setupProductVideos() {
  productVideos.forEach((vid, idx) => {
    vid.muted = true;
    vid.loop = true;
    vid.playsInline = true;
    vid.style.opacity = idx === activeVariantIndex ? '1' : '0';

    // Synchronize loop if needed
    vid.addEventListener('ended', () => {
      vid.currentTime = 0;
      vid.play();
    });
  });
}

// ===================================================================
// 3D PRINTING MACHINE LOADER
// ===================================================================

function runPrinterLoader() {
  const tl = gsap.timeline({
    onComplete: onPrinterComplete
  });

  // Printing state variables
  const printState = {
    progress: 0,
    temp: 212.0,
    layer: 1
  };

  // Horizontal print head rapid reciprocating scan (simulating infill passes)
  gsap.to(printHead, {
    x: '+=120',
    duration: 0.3,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut"
  });

  // Dynamic temperature & telemetry jitter
  const tempInterval = setInterval(() => {
    const jitter = (Math.random() * 1.6 - 0.8);
    const curTemp = (215.0 + jitter).toFixed(1);
    extruderTempVal.textContent = `${curTemp}°C`;
  }, 120);

  // Main Print Progress Animation
  tl.to(hudStatusText, {
    text: "HEATING BED & NOZZLE...",
    duration: 0.4
  })
  .to(hudStatusText, {
    text: "PRINTING: XGEARUP_BY_NINA.STL",
    duration: 0.2
  })
  .to(printState, {
    progress: 100,
    layer: 67,
    duration: 3.2,
    ease: "power1.inOut",
    onUpdate: () => {
      const p = printState.progress;
      const rounded = Math.round(p);
      hudPercent.textContent = rounded;
      hudProgressFill.style.width = `${p}%`;

      const curLayer = Math.min(67, Math.max(1, Math.round((p / 100) * 67)));
      layerVal.textContent = `${String(curLayer).padStart(3, '0')} / 067`;

      // Vertical Z-lift of the carriage
      const carriageBottom = 12 + (p * 0.72); // 12% to 84%
      extruderAssembly.style.bottom = `${carriageBottom}%`;

      // Reveal SVG Logo layer by layer from bottom to top
      logoPrinted.style.clipPath = `inset(${100 - p}% 0 0 0)`;
    }
  })
  // Print finish curing phase
  .to(hudStatusText, {
    text: "UV CURING MATRIX // 100% COMPLETE",
    duration: 0.4
  })
  .to(logoPrinted, {
    filter: "drop-shadow(0 0 35px rgba(242, 0, 160, 0.9)) brightness(1.3)",
    duration: 0.3,
    yoyo: true,
    repeat: 1
  })
  // Park print head
  .to(extruderAssembly, {
    y: -80,
    opacity: 0,
    duration: 0.5,
    ease: "power2.in"
  }, "+=0.1")
  // Clean up timer
  .add(() => {
    clearInterval(tempInterval);
  });
}

function onPrinterComplete() {
  if (matrixOrb) {
    matrixOrb.setState('idle');
    matrixOrb.setColor('#00ff88');
  }

  // Smoothly dissolve the 3D printer loader screen
  gsap.to(printerLoader, {
    opacity: 0,
    scale: 1.04,
    duration: 0.7,
    ease: "power2.inOut",
    onComplete: () => {
      printerLoader.style.display = 'none';
      startJpgIntroAnimation();
    }
  });
}

// ===================================================================
// INITIAL JPG ANIMATION & SEAMLESS LOOP HANDOFF
// ===================================================================

function startJpgIntroAnimation() {
  isIntroPlaying = true;
  if (markerStatus) markerStatus.textContent = "INITIALIZING JPG SEQUENCE [024-067]...";

  // Ensure canvas is visible and video is prepared underneath
  bgCanvas.classList.remove('fade-out');
  bgVideo.classList.remove('active');
  bgVideo.currentTime = 0;
  bgVideo.pause();

  const animObj = { frame: 0 };
  const totalFrames = loadedFrames.length; // 44 frames (024 to 067)

  gsap.to(animObj, {
    frame: totalFrames - 1,
    duration: totalFrames / FPS, // ~1.83 seconds
    ease: "none",
    onUpdate: () => {
      const idx = Math.min(totalFrames - 1, Math.round(animObj.frame));
      const img = loadedFrames[idx];
      if (img) {
        drawFrame(img);
        const frameNum = START_FRAME + idx;
        if (markerStatus) markerStatus.textContent = `PLAYING JPG FRAME: ${String(frameNum).padStart(3, '0')} / 067`;
      }
    },
    onComplete: () => {
      // Reached Frame 067: "desde aqui comienza el; lopp.jpg"!
      onJpgAnimationComplete();
    }
  });
}

function onJpgAnimationComplete() {
  isIntroPlaying = false;
  isLoopLocked = true;

  // Mark the loop handover point explicitly
  if (markerStatus) {
    markerStatus.innerHTML = "BG LOOP: <span style='color:#00ff88;'>LOCKED @ FRAME 067</span> (CONTINUOUS)";
  }

  // Start playing the looping background video
  bgVideo.currentTime = 0;
  bgVideo.play().then(() => {
    bgVideo.classList.add('active');
    // Fade out the canvas smoothly so the video takes over seamlessly
    setTimeout(() => {
      bgCanvas.classList.add('fade-out');
    }, 150);
  }).catch((err) => {
    console.warn("Autoplay notice:", err);
    bgVideo.classList.add('active');
  });

  // Reveal the main Hero and start product videos
  app.classList.add('visible');
  gsap.to(app, {
    opacity: 1,
    duration: 0.8,
    ease: "power2.out",
    onStart: () => {
      syncTypographyWidth();
      // Start product videos synchronized
      productVideos.forEach(v => {
        v.currentTime = 0;
        v.play().catch(() => {});
      });
    }
  });
}

// ===================================================================
// PRODUCT COLOR SWITCHER CONTROLLER
// ===================================================================

function switchColorVariant(targetIndex) {
  if (targetIndex === activeVariantIndex) return;

  const currentVideo = productVideos[activeVariantIndex];
  const nextVideo = productVideos[targetIndex];
  const targetData = COLOR_VARIANTS[targetIndex];

  // Synchronize playback timeline so the 3D box doesn't jump
  if (currentVideo && nextVideo) {
    try {
      nextVideo.currentTime = currentVideo.currentTime;
    } catch (e) {}

    // Crossfade with GSAP
    gsap.to(currentVideo, {
      opacity: 0,
      duration: 0.45,
      ease: "power2.out"
    });
    currentVideo.classList.remove('active');

    nextVideo.classList.add('active');
    gsap.to(nextVideo, {
      opacity: 1,
      duration: 0.45,
      ease: "power2.out"
    });
  }

  // Update Buttons
  colorButtons.forEach((btn, idx) => {
    if (idx === targetIndex) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update Badge Label
  if (activeColorName) {
    gsap.to(activeColorName, {
      opacity: 0,
      y: -4,
      duration: 0.15,
      onComplete: () => {
        activeColorName.textContent = targetData.name;
        gsap.to(activeColorName, {
          opacity: 1,
          y: 0,
          duration: 0.25
        });
      }
    });
  }

  activeVariantIndex = targetIndex;
}

// ===================================================================
// EVENT LISTENERS
// ===================================================================

function setupEventListeners() {
  // Color Buttons click
  colorButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      switchColorVariant(idx);
    });
  });

  // Keyboard shortcut [1, 2, 3]
  window.addEventListener('keydown', (e) => {
    if (e.key === '1') switchColorVariant(0);
    if (e.key === '2') switchColorVariant(1);
    if (e.key === '3') switchColorVariant(2);
  });

  // Replay Intro Button
  if (btnReplay) {
    btnReplay.addEventListener('click', () => {
      replayFullSequence();
    });
  }
}

function replayFullSequence() {
  // Hide main interface
  gsap.to(app, {
    opacity: 0,
    duration: 0.4,
    onComplete: () => {
      app.classList.remove('visible');

      // Bring back loader
      printerLoader.style.display = 'flex';
      extruderAssembly.style.bottom = '12%';
      extruderAssembly.style.opacity = '1';
      extruderAssembly.style.transform = 'none';
      logoPrinted.style.clipPath = 'inset(100% 0 0 0)';
      logoPrinted.style.filter = 'drop-shadow(0 0 15px rgba(242, 0, 160, 0.5))';

      gsap.to(printerLoader, {
        opacity: 1,
        scale: 1,
        duration: 0.5,
        onComplete: runPrinterLoader
      });
    }
  });
}

// ===================================================================
// START EVERYTHING
// ===================================================================

window.addEventListener('DOMContentLoaded', init);
