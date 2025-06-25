import {
  buildBlock,
  loadHeader,
  loadFooter,
  decorateButtons,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
  fetchPlaceholders,
} from './aem.js';

/**
 * Builds hero block and prepends to main in a new section.
 * @param {Element} main The container element
 */
function buildHeroBlock(main) {
  const h1 = main.querySelector('h1');
  const picture = main.querySelector('picture');
  // eslint-disable-next-line no-bitwise
  if (h1 && picture && (h1.compareDocumentPosition(picture) & Node.DOCUMENT_POSITION_PRECEDING)) {
    const section = document.createElement('div');
    section.append(buildBlock('hero', { elems: [picture, h1] }));
    main.prepend(section);
  }
}

/**
 * Calls placeholders for a current document language
 * @returns placeholders for the language
 */
export async function fetchPlaceholdersForLocale() {
  const langCode = document.documentElement.lang;
  let placeholders = null;
  if (!langCode) {
    placeholders = await fetchPlaceholders();
  } else {
    placeholders = await fetchPlaceholders(`/${langCode.toLowerCase()}`);
  }

  return placeholders;
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks(main) {
  try {
    buildHeroBlock(main);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  // hopefully forward compatible button decoration
  decorateButtons(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
}


export function getHref() {
  if (window.location.href !== 'about:srcdoc') return window.location.href;


  const { location: parentLocation } = window.parent;
  const urlParams = new URLSearchParams(parentLocation.search);
  return `${parentLocation.origin}${urlParams.get('path')}`;
}
export async function loadFragment(path) {
  if (path && path.startsWith('/')) {
    const resp = await fetch(path);
    if (resp.ok) {
      const mainDiv = document.createElement('div');
      const htmlString = await resp.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, 'text/html');

      mainDiv.append(...doc.querySelector('main').children);

      // reset base path for media to fragment base
      const resetAttributeBase = (tag, attr) => {
        mainDiv.querySelectorAll(`${tag}[${attr}^="./media_"]`).forEach((elem) => {
          elem[attr] = new URL(elem.getAttribute(attr), new URL(path, window.location)).href;
        });
      };
      resetAttributeBase('img', 'src');
      resetAttributeBase('source', 'srcset');

      decorateMain(mainDiv);
      await loadSections(mainDiv);
      return mainDiv;
    }
  }
  return null;
}

export async function showCommerceErrorPage(code = 404) {
  window.pageType = 'page-not-found';
  window.pageName = 'page-not-found';
  const errorBlock = await loadFragment(`/${document.documentElement.lang}/fragments/${code}`);
  errorBlock?.querySelector('.section[data-path]:not(.recommendations-container):has(.default-content-wrapper)')?.classList.add('errorPageContent');
  const errorBlockTitle = errorBlock?.querySelector('.default-content-wrapper');
  if (errorBlockTitle) {
    const h5Title = document.createElement('h5');
    h5Title.classList.add('default-content-wrapper');
    h5Title.innerHTML = errorBlockTitle.innerHTML;
    errorBlockTitle.parentNode.replaceChild(h5Title, errorBlockTitle);
  }

  // https://developers.google.com/search/docs/crawling-indexing/javascript/fix-search-javascript
  // Point 2. prevent soft 404 errors
  if (code === 404) {
    const metaRobots = document.createElement('meta');
    metaRobots.name = 'robots';
    metaRobots.content = 'noindex';
    document.head.appendChild(metaRobots);
  }

  document.querySelector('body').classList.add('error-page');
  document.querySelector('main').appendChild(errorBlock);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  const path = getHref();
  if (path.includes('/ar/')) {
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
  }
  if (main) {
    if (window.isErrorPage) {
      main.innerHTML = '';
      await showCommerceErrorPage(404);
    }
    decorateMain(main);
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  const main = doc.querySelector('main');
  await loadSections(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadHeader(doc.querySelector('header'));
  loadFooter(doc.querySelector('footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}
 
loadPage();
