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
  { 
    index: 0, 
    name: "STEALTH CARBON", 
    hex: "#5c6c39", 
    id: "video-prod-0",
    from: "#5c6c39",
    to: "#384421",
    glow: "rgba(92, 108, 57, 0.45)"
  },
  { 
    index: 1, 
    name: "CYBER EMERALD", 
    hex: "#3b7a34", 
    id: "video-prod-1",
    from: "#3b7a34",
    to: "#224c1e",
    glow: "rgba(59, 122, 52, 0.45)"
  },
  { 
    index: 2, 
    name: "NEON MAGENTA", 
    hex: "#f200a0", 
    id: "video-prod-2",
    from: "#f200a0",
    to: "#a00069",
    glow: "rgba(242, 0, 160, 0.45)"
  }
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
  document.body.classList.add('is-loading');
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

  // 7. Setup Ecommerce System
  setupEcommerce();

  // 8. Synchronize typography width (YOU CAN IMAGE OF == ANY-GEAR)
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
  document.body.classList.remove('is-loading');
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

  // Update Dynamic Glow on BUY Button
  const btnBuy = document.getElementById('btn-buy-peptides');
  if (btnBuy && targetData.from) {
    btnBuy.style.setProperty('--active-accent-from', targetData.from);
    btnBuy.style.setProperty('--active-accent-to', targetData.to);
    btnBuy.style.setProperty('--active-accent-glow', targetData.glow);
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
// ECOMMERCE MATRIX SYSTEM (CART, UP-SALES, CHECKOUT & GSAP MOTION)
// ===================================================================

const FREE_SHIPPING_THRESHOLD = 45.00;
const SHIPPING_FLAT_RATE = 4.95;

const PRODUCTS_CATALOG = {
  'caja-4p': {
    id: 'caja-4p',
    name: 'Caja 4 Peptides (4P)',
    type: 'box',
    price: 24.95,
    capacity: '4 Viales',
    img: '/products/box-4p.png'
  },
  'caja-6p': {
    id: 'caja-6p',
    name: 'Caja 6 Peptides (6P)',
    type: 'box',
    price: 28.95,
    capacity: '6 Viales',
    img: '/products/box-6p.png'
  },
  'caja-8p': {
    id: 'caja-8p',
    name: 'Caja 8 Peptides (8P)',
    type: 'box',
    price: 32.95,
    capacity: '8 Viales',
    img: '/products/box-8p.png',
    available: false
  }
};

const UPSELLS_CATALOG = {
  'paw-whistle': {
    id: 'paw-whistle',
    name: 'Silbato Táctico Garra (Paw Whistle)',
    type: 'accessory',
    price: 9.95,
    originalPrice: 14.95,
    savings: 5.00,
    img: '/products/upsell-paw-whistle.png',
    desc: 'Silbato de emergencia 115dB con acople para mosquetón o llavero de estuche.'
  },
  'star-wand': {
    id: 'star-wand',
    name: 'Varita Táctica Star Baton',
    type: 'accessory',
    price: 11.95,
    originalPrice: 16.95,
    savings: 5.00,
    img: '/products/upsell-star-wand.png',
    desc: 'Llavero táctico de colección en polímero indeformable con mango moleteado.'
  },
  'latches-pack': {
    id: 'latches-pack',
    name: 'Set 3x Pestillos Intercambiables',
    type: 'accessory',
    price: 6.95,
    originalPrice: 9.95,
    savings: 3.00,
    img: '/products/box-4p.png',
    desc: 'Pack tricolor de pestillos de precisión: Stealth, Emerald y Magenta.'
  }
};

const COLOR_NAMES_MAP = {
  stealth: 'Stealth Carbon',
  emerald: 'Cyber Emerald',
  magenta: 'Neon Magenta'
};

let cart = [];
let cardColorSelections = {
  'caja-4p': 'stealth',
  'caja-6p': 'stealth'
};
let activeUpsellAction = null;

function setupEcommerce() {
  loadCartFromStorage();
  updateCartUI();
  setupVariantChips();
  setupAddToCartButtons();
  setupUpsellButtons();
  setupCartDrawer();
  setupSmartUpsellModal();
  setupCheckoutModal();
  setupHeaderScroll();
  setupSmoothNavigation();
  setupNotifyWaitlist();
}

// -------------------------------------------------------------------
// STORAGE & CART STATE
// -------------------------------------------------------------------

function loadCartFromStorage() {
  try {
    const raw = localStorage.getItem('xgearup_cart_v2');
    if (raw) {
      cart = JSON.parse(raw);
      if (!Array.isArray(cart)) cart = [];
    }
  } catch (err) {
    console.warn('Error loading cart:', err);
    cart = [];
  }
}

function saveCartToStorage() {
  try {
    localStorage.setItem('xgearup_cart_v2', JSON.stringify(cart));
  } catch (err) {
    console.warn('Error saving cart:', err);
  }
}

function addToCart(productData, openDrawer = true, triggerUpsell = false) {
  const existingIdx = cart.findIndex(
    item => item.id === productData.id && item.variant === productData.variant
  );

  if (existingIdx > -1) {
    cart[existingIdx].qty += (productData.qty || 1);
  } else {
    cart.push({
      id: productData.id,
      name: productData.name,
      type: productData.type || 'product',
      price: parseFloat(productData.price),
      variant: productData.variant || 'Standard',
      img: productData.img,
      qty: productData.qty || 1
    });
  }

  saveCartToStorage();
  updateCartUI();

  // GSAP animation on Cart Badge
  const badge = document.getElementById('cart-count-badge');
  if (badge) {
    gsap.fromTo(badge, 
      { scale: 1.7, rotate: -15 }, 
      { scale: 1, rotate: 0, duration: 0.35, ease: 'back.out(2)' }
    );
  }

  // Trigger Smart Upsell Modal or open cart
  if (triggerUpsell) {
    openSmartUpsellModal(productData.id);
  } else if (openDrawer) {
    openCartDrawer();
  }
}

function removeFromCart(index) {
  if (index >= 0 && index < cart.length) {
    const removedItem = cart[index];
    cart.splice(index, 1);
    saveCartToStorage();
    updateCartUI();
    showToast(`Eliminado: ${removedItem.name}`, 'info');
  }
}

function updateCartItemQty(index, delta) {
  if (index >= 0 && index < cart.length) {
    cart[index].qty += delta;
    if (cart[index].qty <= 0) {
      removeFromCart(index);
    } else {
      saveCartToStorage();
      updateCartUI();
    }
  }
}

function calculateCartTotals() {
  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const totalItems = cart.reduce((acc, item) => acc + item.qty, 0);
  const isFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD && subtotal > 0;
  const shipping = subtotal > 0 ? (isFreeShipping ? 0 : SHIPPING_FLAT_RATE) : 0;
  const total = subtotal + shipping;

  return { subtotal, totalItems, isFreeShipping, shipping, total };
}

// -------------------------------------------------------------------
// CART UI UPDATER
// -------------------------------------------------------------------

function updateCartUI() {
  const { subtotal, totalItems, isFreeShipping, shipping, total } = calculateCartTotals();

  // 1. Header Badges
  const countBadge = document.getElementById('cart-count-badge');
  const totalBadge = document.getElementById('cart-total-badge');
  const drawerCount = document.getElementById('cart-drawer-count');

  if (countBadge) countBadge.textContent = totalItems;
  if (totalBadge) totalBadge.textContent = `$${subtotal.toFixed(2)}`;
  if (drawerCount) drawerCount.textContent = `(${totalItems})`;

  // 2. Shipping Goal Meter
  const meterText = document.getElementById('shipping-meter-text');
  const meterFill = document.getElementById('shipping-meter-fill');

  if (meterText && meterFill) {
    if (subtotal >= FREE_SHIPPING_THRESHOLD) {
      meterText.innerHTML = `🎉 <strong>¡ENVÍO GRATUITO DESBLOQUEADO!</strong>`;
      meterFill.style.width = '100%';
    } else {
      const remaining = (FREE_SHIPPING_THRESHOLD - subtotal).toFixed(2);
      const percentage = Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100));
      meterText.innerHTML = `Añade <strong>$${remaining}</strong> más para <strong>ENVÍO GRATIS</strong>`;
      meterFill.style.width = `${percentage}%`;
    }
  }

  // 3. Render Cart Items List
  const itemsContainer = document.getElementById('cart-items-wrapper');
  if (itemsContainer) {
    if (cart.length === 0) {
      itemsContainer.innerHTML = `
        <div class="cart-empty-state">
          <svg class="cart-empty-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <path d="M16 10a4 4 0 0 1-8 0"></path>
          </svg>
          <div class="cart-empty-title">TU ARSENAL ESTÁ VACÍO</div>
          <p class="cart-empty-sub">Selecciona tu caja de péptidos (4P o 6P) con tu color de pestillo preferido para comenzar.</p>
          <a href="#products" class="cart-empty-btn" id="btn-empty-explore">EXPLORAR CAJAS</a>
        </div>
      `;

      const btnExplore = document.getElementById('btn-empty-explore');
      if (btnExplore) {
        btnExplore.addEventListener('click', (e) => {
          e.preventDefault();
          closeCartDrawer();
          scrollToSection('products');
        });
      }
    } else {
      itemsContainer.innerHTML = cart.map((item, idx) => `
        <div class="cart-item-card" data-index="${idx}">
          <div class="cart-item-thumb">
            <img src="${item.img}" alt="${item.name}" class="cart-item-img">
          </div>
          <div class="cart-item-info">
            <span class="cart-item-name">${item.name}</span>
            <span class="cart-item-variant">${item.variant}</span>
            <div class="cart-item-bottom-row">
              <div class="cart-item-stepper">
                <button class="stepper-btn btn-qty-minus" data-index="${idx}">-</button>
                <span class="stepper-val">${item.qty}</span>
                <button class="stepper-btn btn-qty-plus" data-index="${idx}">+</button>
              </div>
              <span class="cart-item-price">$${(item.price * item.qty).toFixed(2)}</span>
            </div>
          </div>
          <button class="cart-item-remove-btn btn-remove-item" data-index="${idx}" title="Eliminar">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `).join('');

      // Add listener to stepper and remove buttons
      itemsContainer.querySelectorAll('.btn-qty-minus').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-index'), 10);
          updateCartItemQty(idx, -1);
        });
      });

      itemsContainer.querySelectorAll('.btn-qty-plus').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-index'), 10);
          updateCartItemQty(idx, 1);
        });
      });

      itemsContainer.querySelectorAll('.btn-remove-item').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-index'), 10);
          removeFromCart(idx);
        });
      });
    }
  }

  // 4. Render In-Cart Quick Up-Sales
  renderInCartUpsells();

  // 5. Drawer Totals
  const subtotalEl = document.getElementById('cart-subtotal-val');
  const shippingEl = document.getElementById('cart-shipping-val');
  const totalEl = document.getElementById('cart-total-val');

  if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
  if (shippingEl) shippingEl.textContent = isFreeShipping ? 'GRATIS' : (subtotal > 0 ? `$${shipping.toFixed(2)}` : '$0.00');
  if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;

  // 6. Checkout Modal Total
  const checkTotalEl = document.getElementById('checkout-total-val');
  if (checkTotalEl) checkTotalEl.textContent = `$${total.toFixed(2)}`;
}

// -------------------------------------------------------------------
// IN-CART 1-CLICK UP-SALES
// -------------------------------------------------------------------

function renderInCartUpsells() {
  const container = document.getElementById('cart-upsell-items');
  const section = document.getElementById('cart-upsell-section');
  if (!container || !section) return;

  // Filter out upsells already present in the cart
  const availableUpsells = Object.values(UPSELLS_CATALOG).filter(
    upsell => !cart.some(item => item.id === upsell.id)
  );

  if (availableUpsells.length === 0 || cart.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  container.innerHTML = availableUpsells.slice(0, 2).map(item => `
    <div class="mini-upsell-card">
      <div class="mini-upsell-left">
        <img src="${item.img}" alt="${item.name}" class="mini-upsell-img">
        <div class="mini-upsell-details">
          <span class="mini-upsell-name">${item.name}</span>
          <span class="mini-upsell-price">$${item.price.toFixed(2)} <span style="font-size:9px; text-decoration:line-through; opacity:0.5;">$${item.originalPrice.toFixed(2)}</span></span>
        </div>
      </div>
      <button class="btn-mini-upsell" data-upsell-id="${item.id}">
        + AÑADIR
      </button>
    </div>
  `).join('');

  container.querySelectorAll('.btn-mini-upsell').forEach(btn => {
    btn.addEventListener('click', () => {
      const upId = btn.getAttribute('data-upsell-id');
      const item = UPSELLS_CATALOG[upId];
      if (item) {
        addToCart({
          id: item.id,
          name: item.name,
          type: 'accessory',
          price: item.price,
          variant: 'Edición Táctica',
          img: item.img,
          qty: 1
        }, true, false);
        showToast(`🔥 Up-Sale añadido: ${item.name}`, 'success');
      }
    });
  });
}

// -------------------------------------------------------------------
// VARIANT CHIP SELECTION
// -------------------------------------------------------------------

function setupVariantChips() {
  const chipContainers = document.querySelectorAll('.variant-chips');
  chipContainers.forEach(container => {
    const cardId = container.getAttribute('data-card');
    const chips = container.querySelectorAll('.variant-chip');

    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const colorKey = chip.getAttribute('data-color');
        cardColorSelections[cardId] = colorKey;
      });
    });
  });
}

// -------------------------------------------------------------------
// ADD TO CART BUTTONS (CATALOG)
// -------------------------------------------------------------------

function setupAddToCartButtons() {
  const addButtons = document.querySelectorAll('.btn-add-cart');
  addButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const pId = btn.getAttribute('data-product-id');
      const prod = PRODUCTS_CATALOG[pId];
      if (!prod) return;

      const selectedColorKey = cardColorSelections[pId] || 'stealth';
      const variantName = COLOR_NAMES_MAP[selectedColorKey] || 'Stealth Carbon';

      addToCart({
        id: prod.id,
        name: prod.name,
        type: prod.type,
        price: prod.price,
        variant: `Pestillo: ${variantName}`,
        img: prod.img,
        qty: 1
      }, true, true); // triggerUpsell = true

      showToast(`✓ ${prod.name} añadido al carrito`, 'success');
    });
  });
}

// -------------------------------------------------------------------
// UP-SELL ACCESSORY BUTTONS
// -------------------------------------------------------------------

function setupUpsellButtons() {
  const upsellButtons = document.querySelectorAll('.btn-add-upsell');
  upsellButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const upId = btn.getAttribute('data-upsell-id');
      const item = UPSELLS_CATALOG[upId];
      if (!item) return;

      addToCart({
        id: item.id,
        name: item.name,
        type: 'accessory',
        price: item.price,
        variant: 'Edición Táctica',
        img: item.img,
        qty: 1
      }, true, false);

      showToast(`✓ Up-Sale añadido: ${item.name}`, 'success');
    });
  });
}

// -------------------------------------------------------------------
// SMART UP-SELL MODAL (TRIGGERED ON ADDING A CAJA)
// -------------------------------------------------------------------

function setupSmartUpsellModal() {
  const backdrop = document.getElementById('upsell-modal-backdrop');
  const closeBtn = document.getElementById('upsell-modal-close');
  const skipBtn = document.getElementById('btn-upsell-skip');
  const acceptBtn = document.getElementById('btn-upsell-accept');

  if (closeBtn) closeBtn.addEventListener('click', closeSmartUpsellModal);
  if (skipBtn) skipBtn.addEventListener('click', () => {
    closeSmartUpsellModal();
    openCartDrawer();
  });

  if (acceptBtn) {
    acceptBtn.addEventListener('click', () => {
      if (activeUpsellAction) {
        activeUpsellAction();
      }
      closeSmartUpsellModal();
      openCartDrawer();
    });
  }

  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        closeSmartUpsellModal();
        openCartDrawer();
      }
    });
  }
}

function openSmartUpsellModal(addedProductId) {
  const backdrop = document.getElementById('upsell-modal-backdrop');
  const modalBox = document.getElementById('upsell-modal-box');
  const titleEl = document.getElementById('upsell-modal-title');
  const subEl = document.getElementById('upsell-modal-sub');
  const offerContainer = document.getElementById('upsell-modal-offer');
  const acceptText = document.getElementById('upsell-accept-text');

  if (!backdrop || !modalBox || !offerContainer) return;

  if (addedProductId === 'caja-4p') {
    // Smart Upsell 1: Upgrade to 6P (+ $4.00) or add Paw Whistle ($9.95)
    titleEl.textContent = '¡MEJORA A LA CAJA 6P POR SOLO +$4.00!';
    subEl.textContent = 'Aumenta un 50% tu capacidad para viales de péptidos pagando únicamente la diferencia de precio ($28.95 en lugar de $34.95).';

    offerContainer.innerHTML = `
      <div class="upsell-offer-card">
        <div class="upsell-offer-thumb">
          <img src="/products/box-6p.png" alt="Caja 6 Peptides" class="upsell-offer-img">
        </div>
        <div class="upsell-offer-info">
          <span class="upsell-offer-name">Upgrade a Caja 6 Peptides (6P)</span>
          <span class="upsell-offer-desc">6 Viales protegidos, chasis rectangular reforzado y sellado hermético.</span>
          <div class="upsell-offer-pricing">
            <span class="upsell-price-cut">Valor: $34.95</span>
            <span class="upsell-price-promo">+ Solo $4.00 adicional</span>
          </div>
        </div>
      </div>
    `;

    if (acceptText) acceptText.textContent = 'ACTUALIZAR A CAJA 6P (+$4.00)';

    activeUpsellAction = () => {
      // Find Caja 4p in cart and replace with Caja 6p
      const idx = cart.findIndex(item => item.id === 'caja-4p');
      const selectedColor = cardColorSelections['caja-4p'] || 'stealth';
      const variantName = COLOR_NAMES_MAP[selectedColor] || 'Stealth Carbon';

      if (idx > -1) {
        cart[idx] = {
          id: 'caja-6p',
          name: 'Caja 6 Peptides (6P)',
          type: 'box',
          price: 28.95,
          variant: `Pestillo: ${variantName}`,
          img: '/products/box-6p.png',
          qty: cart[idx].qty
        };
      } else {
        addToCart({
          id: 'caja-6p',
          name: 'Caja 6 Peptides (6P)',
          type: 'box',
          price: 28.95,
          variant: `Pestillo: ${variantName}`,
          img: '/products/box-6p.png',
          qty: 1
        }, false, false);
      }
      saveCartToStorage();
      updateCartUI();
      showToast('🎉 ¡Caja actualizada exitosamente a 6 Peptides!', 'success');
    };
  } else {
    // Smart Upsell 2: Add Paw Whistle ($9.95)
    titleEl.textContent = '¡COMPLEMENTO CON 33% DE DESCUENTO!';
    subEl.textContent = 'Añade el Silbato Táctico Garra con enganche de llavero a precio especial de bundle junto con tu estuche.';

    offerContainer.innerHTML = `
      <div class="upsell-offer-card">
        <div class="upsell-offer-thumb">
          <img src="/products/upsell-paw-whistle.png" alt="Silbato Táctico Garra" class="upsell-offer-img">
        </div>
        <div class="upsell-offer-info">
          <span class="upsell-offer-name">Silbato Táctico Garra (Paw Whistle)</span>
          <span class="upsell-offer-desc">Polímero de alta densidad, 115dB de resonancia y sujeción rápida.</span>
          <div class="upsell-offer-pricing">
            <span class="upsell-price-cut">$14.95</span>
            <span class="upsell-price-promo">$9.95 (Ahorras $5.00)</span>
          </div>
        </div>
      </div>
    `;

    if (acceptText) acceptText.textContent = 'AÑADIR COMPLEMENTO +$9.95';

    activeUpsellAction = () => {
      addToCart({
        id: 'paw-whistle',
        name: 'Silbato Táctico Garra (Paw Whistle)',
        type: 'accessory',
        price: 9.95,
        variant: 'Edición Táctica',
        img: '/products/upsell-paw-whistle.png',
        qty: 1
      }, false, false);
      showToast('🔥 Up-Sale añadido: Silbato Táctico Garra', 'success');
    };
  }

  backdrop.classList.add('active');

  gsap.fromTo(modalBox, 
    { scale: 0.88, opacity: 0, y: 25 },
    { scale: 1, opacity: 1, y: 0, duration: 0.35, ease: 'back.out(1.5)' }
  );
}

function closeSmartUpsellModal() {
  const backdrop = document.getElementById('upsell-modal-backdrop');
  const modalBox = document.getElementById('upsell-modal-box');
  if (!backdrop) return;

  gsap.to(modalBox, {
    scale: 0.92,
    opacity: 0,
    duration: 0.2,
    ease: 'power2.in',
    onComplete: () => {
      backdrop.classList.remove('active');
    }
  });
}

// -------------------------------------------------------------------
// CART DRAWER INTERACTIONS
// -------------------------------------------------------------------

function setupCartDrawer() {
  const toggleBtn = document.getElementById('cart-toggle-btn');
  const closeBtn = document.getElementById('cart-close-btn');
  const backdrop = document.getElementById('cart-backdrop');

  if (toggleBtn) toggleBtn.addEventListener('click', openCartDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeCartDrawer);
  if (backdrop) backdrop.addEventListener('click', closeCartDrawer);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCartDrawer();
      closeSmartUpsellModal();
      closeCheckoutModal();
    }
  });
}

function openCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  const backdrop = document.getElementById('cart-backdrop');
  if (!drawer || !backdrop) return;

  backdrop.classList.add('active');
  drawer.classList.add('active');
  drawer.setAttribute('aria-hidden', 'false');

  gsap.fromTo(drawer,
    { x: '100%' },
    { x: '0%', duration: 0.42, ease: 'power3.out' }
  );
}

function closeCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  const backdrop = document.getElementById('cart-backdrop');
  if (!drawer || !backdrop) return;

  gsap.to(drawer, {
    x: '100%',
    duration: 0.32,
    ease: 'power3.in',
    onComplete: () => {
      drawer.classList.remove('active');
      backdrop.classList.remove('active');
      drawer.setAttribute('aria-hidden', 'true');
    }
  });
}

// -------------------------------------------------------------------
// FAST CHECKOUT MODAL
// -------------------------------------------------------------------

function setupCheckoutModal() {
  const triggerBtn = document.getElementById('btn-checkout-trigger');
  const closeBtn = document.getElementById('checkout-modal-close');
  const backdrop = document.getElementById('checkout-modal-backdrop');
  const form = document.getElementById('checkout-form');
  const successBackBtn = document.getElementById('btn-success-back');
  const formView = document.getElementById('checkout-form-view');
  const successView = document.getElementById('checkout-success-view');

  if (triggerBtn) {
    triggerBtn.addEventListener('click', () => {
      if (cart.length === 0) {
        showToast('Tu carrito está vacío. Añade productos para continuar.', 'warn');
        return;
      }
      closeCartDrawer();
      openCheckoutModal();
    });
  }

  if (closeBtn) closeBtn.addEventListener('click', closeCheckoutModal);
  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeCheckoutModal();
    });
  }

  // Payment radio selection toggle
  const payRadios = document.querySelectorAll('input[name="pay-method"]');
  payRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('.pay-option').forEach(p => p.classList.remove('active'));
      radio.closest('.pay-option').classList.add('active');
      const cardFields = document.getElementById('card-fields');
      if (cardFields) {
        cardFields.style.display = radio.value === 'card' ? 'block' : 'none';
      }
    });
  });

  // Submit checkout
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const btnConfirm = document.getElementById('btn-confirm-order');
      if (btnConfirm) {
        btnConfirm.innerHTML = `<span>TRANSMITIENDO ORDEN...</span>`;
        btnConfirm.style.opacity = '0.7';
        btnConfirm.style.pointerEvents = 'none';
      }

      setTimeout(() => {
        // Generate random order ID
        const orderId = `#XG-${Math.floor(10000 + Math.random() * 90000)}`;
        const orderIdEl = document.getElementById('success-order-id');
        if (orderIdEl) orderIdEl.textContent = orderId;

        if (formView) formView.style.display = 'none';
        if (successView) successView.style.display = 'flex';

        // Clear cart
        cart = [];
        saveCartToStorage();
        updateCartUI();

        showToast('🎉 ¡Orden confirmada con éxito!', 'success');
      }, 1100);
    });
  }

  if (successBackBtn) {
    successBackBtn.addEventListener('click', () => {
      closeCheckoutModal();
      scrollToSection('hero');
      setTimeout(() => {
        if (formView) formView.style.display = 'block';
        if (successView) successView.style.display = 'none';
        const btnConfirm = document.getElementById('btn-confirm-order');
        if (btnConfirm) {
          btnConfirm.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span>CONFIRMAR Y PAGAR ORDEN</span>
          `;
          btnConfirm.style.opacity = '1';
          btnConfirm.style.pointerEvents = 'auto';
        }
      }, 400);
    });
  }
}

function openCheckoutModal() {
  const backdrop = document.getElementById('checkout-modal-backdrop');
  const modalBox = document.getElementById('checkout-modal-box');
  if (!backdrop || !modalBox) return;

  backdrop.classList.add('active');
  gsap.fromTo(modalBox,
    { scale: 0.9, opacity: 0, y: 20 },
    { scale: 1, opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }
  );
}

function closeCheckoutModal() {
  const backdrop = document.getElementById('checkout-modal-backdrop');
  const modalBox = document.getElementById('checkout-modal-box');
  if (!backdrop) return;

  gsap.to(modalBox, {
    scale: 0.92,
    opacity: 0,
    duration: 0.2,
    ease: 'power2.in',
    onComplete: () => {
      backdrop.classList.remove('active');
    }
  });
}

// -------------------------------------------------------------------
// NOTIFY WAITLIST FOR CAJA 8P (EXPLICITLY OUT OF STOCK)
// -------------------------------------------------------------------

function setupNotifyWaitlist() {
  const btnNotify8p = document.getElementById('btn-notify-8p');
  if (btnNotify8p) {
    btnNotify8p.addEventListener('click', (e) => {
      e.preventDefault();
      showToast('ℹ️ Caja 8P: Te hemos añadido a la lista prioritaria para el próximo re-stock.', 'info');
      gsap.fromTo(btnNotify8p, 
        { scale: 1.05 }, 
        { scale: 1, duration: 0.3, ease: 'bounce.out' }
      );
    });
  }
}

// -------------------------------------------------------------------
// HEADER SCROLL DETECTION
// -------------------------------------------------------------------

function setupHeaderScroll() {
  const header = document.getElementById('app-header');
  if (!header) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }, { passive: true });
}

// -------------------------------------------------------------------
// SMOOTH NAVIGATION
// -------------------------------------------------------------------

function setupSmoothNavigation() {
  const links = document.querySelectorAll('a[href^="#"]');
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href').replace('#', '');
      if (targetId) {
        e.preventDefault();
        scrollToSection(targetId);
      }
    });
  });
}

function scrollToSection(targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;

  const headerOffset = 70;
  const elementPosition = el.getBoundingClientRect().top;
  const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

  window.scrollTo({
    top: offsetPosition,
    behavior: 'smooth'
  });
}

// -------------------------------------------------------------------
// CYBER TOAST NOTIFICATIONS SYSTEM
// -------------------------------------------------------------------

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type}`;
  
  let iconSvg = '';
  if (type === 'success') {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00ff88" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
  } else if (type === 'warn') {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff4545" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  } else {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
  }

  toast.innerHTML = `
    <span class="toast-icon">${iconSvg}</span>
    <span class="toast-text">${message}</span>
  `;

  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('active');
  });

  setTimeout(() => {
    toast.classList.remove('active');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 400);
  }, 3200);
}

// ===================================================================
// START EVERYTHING
// ===================================================================

window.addEventListener('DOMContentLoaded', init);
