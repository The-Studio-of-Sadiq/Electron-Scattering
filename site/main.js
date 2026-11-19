/**
 * Electron Scattering Simulator - Landing Page Script
 * Features:
 * - Light/Dark Theme toggle with localStorage persistence (safe try/catch)
 * - Mobile Navigation drawer with accessible keyboard/focus handling
 * - BibTeX & Code Block Copy-to-Clipboard with feedback states
 * - Lightbox modal for interactive architecture figure expansion
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // 1. Theme Management (Dark / Light Mode)
  // ---------------------------------------------------------------------------
  const STORAGE_KEY = 'elsepa_site_theme';
  const htmlRoot = document.documentElement;
  const themeToggleBtn = document.getElementById('theme-toggle');

  function getStoredTheme() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
    } catch (e) {
      // localStorage may be disabled or restricted in private browsing
      console.warn('Unable to access localStorage for theme preference:', e);
    }
    return null;
  }

  function getSystemTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  }

  function applyTheme(theme, save = false) {
    htmlRoot.setAttribute('data-theme', theme);
    if (themeToggleBtn) {
      const nextTheme = theme === 'dark' ? 'light' : 'dark';
      themeToggleBtn.setAttribute('aria-label', `Switch to ${nextTheme} theme`);
      themeToggleBtn.setAttribute('title', `Switch to ${nextTheme} theme`);
    }

    if (save) {
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch (e) {
        console.warn('Unable to persist theme to localStorage:', e);
      }
    }
  }

  // Initial theme setup
  const initialTheme = getStoredTheme() || getSystemTheme();
  applyTheme(initialTheme, false);

  // Toggle button handler
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', function () {
      const currentTheme = htmlRoot.getAttribute('data-theme') || 'dark';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      applyTheme(newTheme, true);
    });
  }

  // Listen for system theme changes if no manual preference is saved
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function (e) {
      if (!getStoredTheme()) {
        applyTheme(e.matches ? 'light' : 'dark', false);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 2. Mobile Navigation Drawer
  // ---------------------------------------------------------------------------
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileNav = document.getElementById('mobile-nav');

  function toggleMobileMenu(forceState) {
    if (!mobileMenuBtn || !mobileNav) return;
    const isExpanded = forceState !== undefined ? forceState : mobileMenuBtn.getAttribute('aria-expanded') !== 'true';
    mobileMenuBtn.setAttribute('aria-expanded', String(isExpanded));
    mobileMenuBtn.setAttribute('aria-label', isExpanded ? 'Close navigation menu' : 'Open navigation menu');
    mobileNav.setAttribute('aria-hidden', String(!isExpanded));
    mobileNav.classList.toggle('is-open', isExpanded);

    if (isExpanded) {
      const firstLink = mobileNav.querySelector('a');
      if (firstLink) firstLink.focus();
    }
  }

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', function () {
      toggleMobileMenu();
    });
  }

  // Close mobile nav when clicking any link inside it
  if (mobileNav) {
    const mobileLinks = mobileNav.querySelectorAll('.mobile-nav-link, .btn-mobile-launch');
    mobileLinks.forEach(function (link) {
      link.addEventListener('click', function () {
        toggleMobileMenu(false);
      });
    });
  }

  // ---------------------------------------------------------------------------
  // 3. Clipboard Utilities
  // ---------------------------------------------------------------------------
  function copyTextToClipboard(text, onSuccess, onError) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onSuccess).catch(function () {
        fallbackCopy(text, onSuccess, onError);
      });
    } else {
      fallbackCopy(text, onSuccess, onError);
    }
  }

  function fallbackCopy(text, onSuccess, onError) {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) {
        if (onSuccess) onSuccess();
      } else {
        if (onError) onError();
      }
    } catch (err) {
      if (onError) onError(err);
    }
  }

  // BibTeX Copy Button
  const copyBibtexBtn = document.getElementById('copy-bibtex-btn');
  const bibtexCodeEl = document.getElementById('bibtex-code');
  const copyBibtexText = document.getElementById('copy-bibtex-text');

  if (copyBibtexBtn && bibtexCodeEl && copyBibtexText) {
    copyBibtexBtn.addEventListener('click', function () {
      const textToCopy = bibtexCodeEl.innerText || bibtexCodeEl.textContent;
      copyTextToClipboard(textToCopy.trim(), function () {
        const originalText = copyBibtexText.textContent;
        copyBibtexText.textContent = 'Copied!';
        copyBibtexBtn.style.borderColor = '#10b981';
        copyBibtexBtn.style.color = '#10b981';

        setTimeout(function () {
          copyBibtexText.textContent = originalText;
          copyBibtexBtn.style.borderColor = '';
          copyBibtexBtn.style.color = '';
        }, 2200);
      });
    });
  }

  // Code Block Copy Buttons (Get Started cards)
  const codeCopyButtons = document.querySelectorAll('.btn-copy-code');
  codeCopyButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const targetSelector = btn.getAttribute('data-copy-target');
      if (!targetSelector) return;
      const targetEl = document.querySelector(targetSelector);
      if (!targetEl) return;

      const text = targetEl.innerText || targetEl.textContent;
      copyTextToClipboard(text.trim(), function () {
        const copySpan = btn.querySelector('.copy-text');
        if (copySpan) {
          const original = copySpan.textContent;
          copySpan.textContent = 'Copied!';
          btn.style.color = '#10b981';

          setTimeout(function () {
            copySpan.textContent = original;
            btn.style.color = '';
          }, 2000);
        }
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Architecture Figure Lightbox Modal
  // ---------------------------------------------------------------------------
  const lightboxModal = document.getElementById('figure-lightbox');
  const lightboxImage = document.getElementById('lightbox-image');
  const lightboxTitle = document.getElementById('lightbox-title');
  const lightboxDesc = document.getElementById('lightbox-desc');
  const lightboxCloseBtn = document.getElementById('lightbox-close');
  const lightboxBackdrop = document.getElementById('lightbox-backdrop');
  let lastActiveElement = null;

  function openLightbox(src, title, desc, triggerElement) {
    if (!lightboxModal || !lightboxImage) return;
    lastActiveElement = triggerElement || document.activeElement;

    // Only show the site's own figures (figures/<name>.svg|png), never an arbitrary URL.
    const safeSrc = /^figures\/[\w-]+\.(svg|png)$/.test(String(src)) ? String(src) : '';
    if (!safeSrc) return;
    lightboxImage.src = safeSrc;
    lightboxImage.alt = title || 'Architecture Figure';
    if (lightboxTitle) lightboxTitle.textContent = title || 'Figure View';
    if (lightboxDesc) lightboxDesc.textContent = desc || '';

    lightboxModal.classList.add('is-active');
    lightboxModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden'; // prevent scrolling background

    if (lightboxCloseBtn) lightboxCloseBtn.focus();
  }

  function closeLightbox() {
    if (!lightboxModal) return;
    lightboxModal.classList.remove('is-active');
    lightboxModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    if (lightboxImage) lightboxImage.src = '';
    if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
      lastActiveElement.focus();
    }
  }

  // Bind figure cards
  const figureCards = document.querySelectorAll('.figure-card');
  figureCards.forEach(function (card) {
    const src = card.getAttribute('data-figure-src');
    const title = card.getAttribute('data-figure-title');
    const desc = card.getAttribute('data-figure-desc');

    const imageContainer = card.querySelector('.figure-image-container');
    if (imageContainer && src) {
      imageContainer.addEventListener('click', function () {
        openLightbox(src, title, desc, card.querySelector('.figure-zoom-btn') || card);
      });
    }

    const zoomBtn = card.querySelector('.figure-zoom-btn');
    if (zoomBtn && src) {
      zoomBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        openLightbox(src, title, desc, zoomBtn);
      });
    }
  });

  if (lightboxCloseBtn) {
    lightboxCloseBtn.addEventListener('click', closeLightbox);
  }

  if (lightboxBackdrop) {
    lightboxBackdrop.addEventListener('click', closeLightbox);
  }

  // Keyboard accessibility: Escape key to close open dialogs
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.key === 'Esc') {
      if (lightboxModal && lightboxModal.classList.contains('is-active')) {
        closeLightbox();
      } else if (mobileNav && mobileNav.classList.contains('is-open')) {
        toggleMobileMenu(false);
      }
    }
  });
})();
