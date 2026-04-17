// Shared nav + footer injected on every page.
// Usage: <script src="/nav.js" data-back="/somepage.html" data-back-label="← Label"></script>
// data-back / data-back-label are optional.

(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }

  const script  = document.currentScript;
  const backHref  = script?.dataset.back  || null;
  const backLabel = script?.dataset.backLabel || '← Back';

  // ── Replace existing <nav> ─────────────────────────────────────
  const existingNav = document.querySelector('nav.nav');

  const nav = document.createElement('nav');
  nav.className = 'nav';
  nav.innerHTML = `
    <div class="nav-left">
      <a class="nav-brand" href="/">
        <img class="nav-logo" src="/verbmaster.svg" alt="" width="24" height="24">
        <span>Verbmaster</span>
      </a>
      ${backHref ? `<a class="nav-back-link" href="${backHref}">${backLabel}</a>` : ''}
    </div>
    <div class="nav-links" id="nav-links">
      <a class="nav-link" href="/">Home</a>
      <a class="nav-link" href="/practicar.html">Practicar</a>
      <a class="nav-link" href="/phrasemaster.html">Phrasemaster</a>
    </div>
    <button class="nav-burger" id="nav-burger" aria-label="Menu">
      <span></span><span></span><span></span>
    </button>
  `;

  if (existingNav) {
    existingNav.replaceWith(nav);
  } else {
    document.body.prepend(nav);
  }

  // highlight active link
  nav.querySelectorAll('.nav-link').forEach(a => {
    if (a.getAttribute('href') === location.pathname ||
        (location.pathname === '/' && a.getAttribute('href') === '/')) {
      a.classList.add('active');
    }
  });

  // burger toggle
  const burger = nav.querySelector('#nav-burger');
  const links  = nav.querySelector('#nav-links');
  burger.addEventListener('click', () => {
    const open = links.classList.toggle('nav-open');
    burger.classList.toggle('nav-burger-open', open);
  });
  // close on link click
  links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    links.classList.remove('nav-open');
    burger.classList.remove('nav-burger-open');
  }));
  // close on outside click
  document.addEventListener('click', e => {
    if (!nav.contains(e.target)) {
      links.classList.remove('nav-open');
      burger.classList.remove('nav-burger-open');
    }
  });

  document.addEventListener('click', e => {
    const tab = e.target.closest('.tab-btn');
    if (tab) tab.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  });

  // ── Footer ────────────────────────────────────────────────────
  function injectFooter() {
    if (document.querySelector('footer.site-footer')) return;

    const footer = document.createElement('footer');
    footer.className = 'site-footer';
    footer.innerHTML = `
      <div class="footer-inner">
        <span class="footer-brand">
          <img class="footer-logo" src="/verbmaster.svg" alt="" width="20" height="20">
          <span>Verbmaster</span>
        </span>
        <nav class="footer-nav">
          <a href="/">Home</a>
          <a href="/practicar.html">Practicar</a>
          <a href="/phrasemaster.html">Phrasemaster</a>
          <a href="/flashcards.html?max_importance=50">Top 50 flashcards</a>
        </nav>
      </div>
    `;
    document.body.appendChild(footer);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectFooter);
  } else {
    injectFooter();
  }
})();
