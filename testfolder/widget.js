(function () {
  const containerSelector = '#niche-cms-widget';
  const scriptElementId = 'niche-cms-widget-loader';
  const fallbackBackend = 'http://localhost:3000';
  const styleId = 'nc-widget-style';
  const logPrefix = '[NicheWidget]';
  const targetSelectors = ['h1', 'h2', 'h3', 'p', 'img'];
  const selectorQuery = targetSelectors.join(',');
  const breadcrumbsMaxDepth = 6;

  const log = (...args) => console.log(logPrefix, ...args);
  const warn = (...args) => console.warn(logPrefix, ...args);
  const error = (...args) => console.error(logPrefix, ...args);

  const normalizeBackendUrl = (value) => {
    const candidate = (value || '').toString().trim();
    if (!candidate) {
      warn('No backend URL provided, falling back to', fallbackBackend);
      return fallbackBackend;
    }
    return candidate.replace(/\/+$/, '');
  };

  const ensureApiBase = (backendUrl) => {
    const normalized = normalizeBackendUrl(backendUrl);
    if (normalized.endsWith('/api')) {
      return normalized;
    }
    return `${normalized}/api`;
  };

  const findLoaderScript = () => {
    const current = document.currentScript;
    if (current && current.id === scriptElementId) {
      log('Loader script detected via document.currentScript');
      return current;
    }

    const byId = document.getElementById(scriptElementId);
    if (byId) {
      log('Loader script detected via ID');
      return byId;
    }

    const bySrc = Array.from(document.getElementsByTagName('script')).find((node) =>
      node.src && node.src.includes('widget.js')
    );
    if (bySrc) {
      log('Loader script detected by src match');
      return bySrc;
    }

    warn('Widget loader script not found via document.currentScript, ID, or src hint');
    return null;
  };

  const waitForElement = (selector, timeout = 4000) =>
    new Promise((resolve) => {
      const deadline = Date.now() + timeout;
      const internalCheck = () => {
        const el = document.querySelector(selector);
        if (el) {
          resolve(el);
          return;
        }
        if (Date.now() >= deadline) {
          resolve(null);
          return;
        }
        setTimeout(internalCheck, 120);
      };
      internalCheck();
    });

  const createMarkup = (items) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'nc-widget';

    const grid = document.createElement('div');
    grid.className = 'nc-widget__grid';

    items.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'nc-widget__card';

      if (item.podtitulok || item.subtitle) {
        const desc = document.createElement('p');
        desc.textContent = item.podtitulok || item.subtitle;
        card.appendChild(desc);
      }

      const title = document.createElement('strong');
      title.textContent = item.titulok || item.title || 'Názov';
      card.appendChild(title);

      if (item.cena || item.price) {
        const price = document.createElement('span');
        price.className = 'nc-widget__price';
        price.textContent = item.cena || item.price;
        card.appendChild(price);
      }

      grid.appendChild(card);
    });

    wrapper.appendChild(grid);
    return wrapper;
  };

  const injectStyles = (root) => {
    if (root.getElementById(styleId)) {
      return;
    }
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .nc-widget { font-family: 'Inter', system-ui, sans-serif; color: #f5f5f5; }
      .nc-widget__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; }
      .nc-widget__card { background: #111; border: 1px solid #222; border-radius: 14px; padding: 1rem; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25); }
      .nc-widget__card strong { display: block; margin-bottom: 0.5rem; font-size: 1rem; }
      .nc-widget__card p { margin: 0 0 0.5rem; color: #c4c4c4; font-size: 0.9rem; }
      .nc-widget__price { color: #f3ca33; font-weight: 700; }
    `;
    root.appendChild(style);
  };

  const buildDomBreadcrumb = (element) => {
    const segments = [];
    let current = element;
    let depth = 0;

    while (current && current !== document.body && depth < breadcrumbsMaxDepth) {
      const tag = current.tagName?.toLowerCase();
      if (!tag) break;
      const identifier =
        current.id || current.getAttribute('data-saas-section') || current.classList?.item(0) || tag;
      const sanitized = (identifier || tag)
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || tag;
      const parent = current.parentElement;
      const siblingIndex = parent
        ? Array.from(parent.children)
            .filter((child) => child.tagName === current.tagName)
            .indexOf(current)
        : 0;
      segments.unshift(`${tag}-${sanitized}-${siblingIndex}`);
      current = parent;
      depth += 1;
    }

    return segments.join('-') || `${element.tagName?.toLowerCase() || 'node'}-0`;
  };

  const ensureElementId = (element) => {
    if (!element) return null;
    const existing = element.getAttribute('data-saas-id');
    if (existing) {
      return existing;
    }
    const generated = buildDomBreadcrumb(element);
    if (generated) {
      element.setAttribute('data-saas-id', generated);
    }
    return generated;
  };

  const normalizePayloadValue = (value) =>
    value === undefined || value === null ? '' : value.toString();

  const getElementValue = (element) => {
    if (!element) return '';
    if (element.tagName?.toLowerCase() === 'img') {
      return element.getAttribute('src') || '';
    }
    return element.textContent?.trim() || element.innerHTML?.trim() || '';
  };

  const collectSiteElements = (host) => {
    const nodes = Array.from(document.querySelectorAll(selectorQuery));
    const results = [];
    const seen = new Set();

    nodes.forEach((element) => {
      if (!element.isConnected) {
        return;
      }
      if (host && host.contains(element)) {
        return;
      }
      const elementId = ensureElementId(element);
      if (!elementId || seen.has(elementId)) {
        return;
      }
      seen.add(elementId);
      const currentValue = normalizePayloadValue(getElementValue(element));
      results.push({
        elementId,
        tagName: element.tagName?.toLowerCase(),
        currentValue,
        originalValue: currentValue
      });
    });

    log('collectSiteElements -> found', results.length, 'unique nodes');
    return results;
  };

  const fetchJson = async (input, init = {}) => {
    const { headers: extraHeaders, ...restInit } = init;
    const response = await fetch(input, {
      mode: 'cors',
      credentials: 'omit',
      headers: {
        Accept: 'application/json',
        ...extraHeaders
      },
      ...restInit
    });

    if (!response.ok) {
      throw new Error(`Fetch failed (${response.status}) ${response.statusText}`);
    }

    return response.json();
  };

  const syncSiteElements = async (syncUrl, clientId, elements) => {
    if (!clientId) {
      warn('syncSiteElements skipped because clientId is empty');
      return [];
    }
    const payload = {
      clientId,
      elements: elements.map((element) => ({
        elementId: element.elementId,
        tagName: element.tagName,
        currentValue: element.currentValue,
        originalValue: element.originalValue,
        valueType: element.tagName === 'img' ? 'src' : 'text'
      }))
    };

    log('Posting', elements.length, 'elements to sync endpoint', syncUrl);
    const data = await fetchJson(syncUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const synced = Array.isArray(data.elements) ? data.elements : [];
    log('syncSiteElements -> server returned', synced.length, 'records');
    return synced;
  };

  const renderItems = (host, items) => {
    const shadowRoot = host.shadowRoot || host.attachShadow({ mode: 'open' });
    shadowRoot.innerHTML = '';
    injectStyles(shadowRoot);
    const markup = createMarkup(items);
    shadowRoot.appendChild(markup);
  };

  const scheduleSync = (() => {
    let syncTimer = null;
    let running = false;

    return (fn) => {
      if (running) {
        log('Sync already running, skipping scheduling');
        return;
      }
      if (syncTimer) {
        clearTimeout(syncTimer);
        syncTimer = null;
      }
      syncTimer = setTimeout(async () => {
        syncTimer = null;
        running = true;
        try {
          await fn();
        } catch (err) {
          error('Scheduled sync failed', err);
        } finally {
          running = false;
        }
      }, 350);
    };
  })();

  const initWidget = async () => {
    log('Initializing');
    const host = await waitForElement(containerSelector, 5000);
    if (!host) {
      error('Widget host container not found (', containerSelector, ')');
      return;
    }

    const status = host.dataset.widgetStatus;
    if (status === 'loaded') {
      warn('Widget already loaded, skipping reinitialization');
      return;
    }

    host.dataset.widgetStatus = 'loading';
    const script = findLoaderScript();
    const backendUrl = ensureApiBase(script?.dataset?.backendUrl || fallbackBackend);
    log('Using backend API base', backendUrl);

    const candidateClientId =
      host.dataset.clientId ||
      host.dataset.client ||
      script?.dataset?.clientId ||
      script?.dataset?.client ||
      script?.getAttribute('data-client') ||
      'saas-default-client';

    if (!candidateClientId) {
      host.dataset.widgetStatus = 'missing-client';
      error('Client ID could not be resolved from host or script');
      return;
    }

    const clientId = candidateClientId.trim();
    const contentUrl = `${backendUrl}/obsah/${encodeURIComponent(clientId)}`;
    const syncUrl = `${backendUrl}/site-elements/sync`;
    log('Resolved clientId', clientId);

    try {
      const items = await fetchJson(contentUrl);
      renderItems(host, Array.isArray(items) ? items : []);
      host.dataset.widgetStatus = 'loaded';
      log('Widget content rendered with', Array.isArray(items) ? items.length : 'unknown', 'items');

      scheduleSync(async () => {
        log('Triggering DOM scan for client', clientId);
        const elements = collectSiteElements(host);
        if (!elements.length) {
          log('No elements found, skipping sync');
          return;
        }
        await syncSiteElements(syncUrl, clientId, elements);
      });
    } catch (err) {
      host.dataset.widgetStatus = 'error';
      error('Widget load failed', err);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    initWidget();
  }
})();
