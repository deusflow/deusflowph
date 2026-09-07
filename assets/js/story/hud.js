/**
 * assets/js/story/hud.js
 * 
 * Cinematic HUD, Multilingual Overlays, Loading Screen, and Act Stepper.
 * Manages all DOM UI interactions for the DeusFlow 3D Story experience.
 */

// Cache DOM elements
let loadingOverlay = null;
let loadingBar = null;
let loadingText = null;
let hudSceneTitle = null;
let hudTimecode = null;
let hudActLabel = null;
let hudPortfolioLink = null;
let stepDots = [];
let scrollHint = null;
let scrollHintText = null;
let finaleCard = null;

let dotClickListeners = [];

function queryElements() {
  loadingOverlay = document.getElementById('loading-overlay');
  loadingBar = document.getElementById('loading-bar');
  loadingText = document.getElementById('loading-text');
  hudSceneTitle = document.getElementById('hud-scene-title');
  hudTimecode = document.getElementById('hud-timecode');
  hudActLabel = document.getElementById('hud-act-label');
  hudPortfolioLink = document.getElementById('hud-portfolio');
  stepDots = Array.from(document.querySelectorAll('.step-dot'));
  scrollHint = document.getElementById('scroll-hint');
  scrollHintText = document.querySelector('#scroll-hint span');
  finaleCard = document.getElementById('portal-finale-card');
}

/**
 * Applies initial localized strings to HUD and cards.
 */
export function applyInitialI18n(i18nStrings) {
  queryElements();
  if (!i18nStrings) return;

  if (scrollHintText && i18nStrings.scrollHint) {
    scrollHintText.innerText = i18nStrings.scrollHint;
  }
  if (hudPortfolioLink && i18nStrings.navPortfolio) {
    const span = hudPortfolioLink.querySelector('span');
    if (span) span.innerText = i18nStrings.navPortfolio;
  }
  if (hudActLabel && i18nStrings.chapters?.[0]?.act) {
    hudActLabel.innerText = i18nStrings.chapters[0].act;
  }
  if (hudSceneTitle && i18nStrings.chapters?.[0]?.title) {
    hudSceneTitle.innerText = i18nStrings.chapters[0].title;
  }
  if (hudTimecode && i18nStrings.progress) {
    hudTimecode.innerText = `${i18nStrings.progress} 0%`;
  }

  if (finaleCard && i18nStrings.finale) {
    const badge = finaleCard.querySelector('.finale-badge');
    const title = finaleCard.querySelector('.finale-title');
    const desc = finaleCard.querySelector('.finale-desc');
    const primaryBtn = finaleCard.querySelector('.finale-btn.primary');
    const secondaryBtn = finaleCard.querySelector('.finale-btn.secondary');

    if (badge) badge.innerText = i18nStrings.finale.badge;
    if (title) title.innerText = i18nStrings.finale.title;
    if (desc) desc.innerText = i18nStrings.finale.desc;
    if (primaryBtn) primaryBtn.innerText = i18nStrings.finale.primaryBtn;
    if (secondaryBtn) secondaryBtn.innerText = i18nStrings.finale.secondaryBtn;
  }
}

/**
 * Updates loading progress bar and percentage text.
 */
export function updateLoadingProgress(progress, label = '') {
  if (loadingBar) loadingBar.style.width = `${progress}%`;
  if (loadingText) {
    loadingText.innerText = label ? `${label} ${progress}%` : `${progress}%`;
  }
}

/**
 * Displays error message if scene fails to load.
 */
export function showLoadingError(message = 'Error loading 3D scene') {
  if (loadingText) loadingText.innerText = message;
}

/**
 * Smoothly fades out and removes loading overlay.
 */
export function hideLoadingOverlay() {
  if (loadingOverlay) {
    loadingOverlay.classList.add('fade-out');
    setTimeout(() => {
      loadingOverlay.style.display = 'none';
    }, 850);
  }
}

/**
 * Sets up click listeners for the chapter stepper dots.
 */
export function setupHudStepper(onStepClick, chapters = []) {
  queryElements();
  cleanupStepperListeners();

  stepDots.forEach((dot, index) => {
    const handler = () => {
      const targetP = chapters[index] ? chapters[index].p : index / Math.max(1, stepDots.length - 1);
      if (typeof onStepClick === 'function') {
        onStepClick(targetP, index);
      } else {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo({
          top: targetP * maxScroll,
          behavior: 'smooth'
        });
      }
    };
    dot.addEventListener('click', handler);
    dotClickListeners.push({ dot, handler });
  });
}

function cleanupStepperListeners() {
  dotClickListeners.forEach(({ dot, handler }) => {
    dot.removeEventListener('click', handler);
  });
  dotClickListeners = [];
}

/**
 * Updates chapter title, act label, percentage timecode, and active dot on scroll.
 */
export function updateHud(progress, i18nStrings) {
  if (!i18nStrings) return;
  const chaptersList = i18nStrings.chapters || [];
  let currentChapter = chaptersList[0] || { act: '', title: '' };
  let currentIdx = 0;

  for (let i = chaptersList.length - 1; i >= 0; i--) {
    if (progress >= chaptersList[i].p - 0.05) {
      currentChapter = chaptersList[i];
      currentIdx = i;
      break;
    }
  }

  const pct = Math.round(progress * 100);

  if (hudSceneTitle) hudSceneTitle.innerText = currentChapter.title;
  if (hudActLabel) hudActLabel.innerText = currentChapter.act;
  if (hudTimecode) hudTimecode.innerText = `${i18nStrings.progress} ${pct}%`;

  stepDots.forEach((dot, idx) => {
    dot.classList.toggle('active', idx === currentIdx);
  });

  // Toggle scroll hint
  if (scrollHint) {
    if (progress > 0.02) {
      scrollHint.classList.add('hidden');
    } else {
      scrollHint.classList.remove('hidden');
    }
  }

  // Toggle finale card
  if (finaleCard) {
    if (progress > 0.94) {
      finaleCard.classList.add('visible');
    } else {
      finaleCard.classList.remove('visible');
    }
  }
}

/**
 * Triggers smooth final screen fade and redirect.
 */
export function triggerFinalRedirect(redirectUrl) {
  const fadeOverlay = document.getElementById('fade-overlay');
  if (fadeOverlay) {
    fadeOverlay.classList.add('active');
  }
  setTimeout(() => {
    window.location.href = redirectUrl;
  }, 800);
}

/**
 * Cleans up DOM event listeners.
 */
export function cleanupHud() {
  cleanupStepperListeners();
}
