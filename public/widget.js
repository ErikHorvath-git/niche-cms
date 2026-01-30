(function () {
  const containerSelector = '#niche-cms-widget';
  const apiBase = 'http://localhost:3000/api/obsah';
  const syncEndpoint = 'http://localhost:3000/api/site-elements/sync';
  const styleId = 'nc-widget-style';
  const localCacheKey = 'niche-cms-widget-cache';
  const targetSelectors = ['h1', 'h2', 'h3', 'p', 'img'];
  const selectorQuery = targetSelectors.join(',');
  const breadcrumbsMaxDepth = 5;
  const mutationConfig = {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true
  };

  let autoMapperInitialized = false;
  let scanTimer = null;
  let isScanning = false;
  let suppressMutationObserver = false;
  let isUpdatingFromDB = false;
  let lastSyncHash = '';
  let mapperHost = null;
  let mapperClientId = '';
  let observer = null;

  const styles = `
    :host {
      all: unset;
      display: block;
      font-family: inherit;
      color: inherit;
    }
    .nc-widget,
    .nc-widget * {
      font-family: inherit;
      color: inherit;
    }
    .nc-widget {
      all: unset;
      display: block;
      width: 100%;
    }
    .nc-widget__grid {
      all: unset;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
      margin-top: 1rem;
      font-family: inherit;
      color: inherit;
    }
    .nc-widget__card {
      all: unset;
      display: block;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 1rem;
      box-shadow: 0 20px 45px rgba(0, 0, 0, 0.25);
    }
    .nc-widget__card strong {
      display: block;
      margin-bottom: 0.5rem;
      font-size: 1rem;
      font-weight: 600;
    }
    .nc-widget__card p {
      margin: 0;
      color: #c6c6c6;
      font-size: 0.9rem;
    }
    .nc-widget__price {
      color: #f3ca33;
      font-weight: 700;
      margin-top: 0.5rem;
      display: block;
    }
    .nc-widget__image {
      width: 100%;
      height: auto;
      border-radius: 12px;
      margin-bottom: 0.75rem;
      object-fit: cover;
    }
    .nc-widget__section {
      all: unset;
      margin-bottom: 1.5rem;
    }
    .nc-widget__section h4 {
      margin: 0 0 0.5rem;
      font-size: 1.15rem;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .nc-widget__table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 0.75rem;
    }
    .nc-widget__table td {
      padding: 0.45rem 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .nc-widget__table td:first-child {
      color: #c6c6c6;
      font-size: 0.85rem;
    }
  `;

  const loadLocalCache = () => {
    if (typeof window === 'undefined' || !window.localStorage) {
      return {};
    }
    try {
      const raw = window.localStorage.getItem(localCacheKey);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      console.warn('Widget cache parse failed', error);
      return {};
    }
  };

  const persistLocalCache = (entries) => {
    if (
      typeof window === 'undefined' ||
      !window.localStorage ||
      !Array.isArray(entries) ||
      entries.length === 0
    ) {
      return;
    }
    try {
      const existingCache = loadLocalCache();
      const updatedCache = { ...existingCache };
      entries.forEach((entry) => {
        if (!entry.element_id) {
          return;
        }
        const normalizedCurrent = normalizePayloadValue(entry.current_value);
        const normalizedOriginal = normalizePayloadValue(
          entry.original_value || entry.default_value || entry.current_value
        );
        const existingEntry = updatedCache[entry.element_id] || {};
        const nextEntry = {
          ...existingEntry,
          originalValue: normalizedOriginal
        };
        const hasLocalValue = Object.prototype.hasOwnProperty.call(existingEntry, 'value');
        if (!hasLocalValue || existingEntry.value === normalizedCurrent) {
          nextEntry.value = normalizedCurrent;
        }
        updatedCache[entry.element_id] = nextEntry;
      });
      window.localStorage.setItem(localCacheKey, JSON.stringify(updatedCache));
    } catch (error) {
      console.warn('Widget cache save failed', error);
    }
  };

  const withSuppressedMutations = (fn) => {
    const previous = suppressMutationObserver;
    suppressMutationObserver = true;
    try {
      return fn();
    } finally {
      suppressMutationObserver = previous;
    }
  };

  const sanitizeSegment = (value) =>
    (value || '')
      .toString()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'node';

  const normalizePayloadValue = (value) =>
    value === undefined || value === null ? '' : value.toString();

  const normalizeForHash = (value) => normalizePayloadValue(value).trim();

  const computeElementsHash = (elements = []) => {
    if (!Array.isArray(elements) || elements.length === 0) {
      return '';
    }
    const normalized = elements
      .map((entry) => {
        const id = entry.element_id || entry.elementId;
        if (!id) {
          return null;
        }
        const value =
          entry.current_value ??
          entry.currentValue ??
          entry.value ??
          entry.default_value ??
          '';
        return { id, value: normalizeForHash(value) };
      })
      .filter(Boolean);
    if (normalized.length === 0) {
      return '';
    }
    const pairs = normalized
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(({ id, value }) => `${id}:${value}`);
    return pairs.join('|');
  };

  const buildDomBreadcrumb = (element) => {
    const segments = [];
    let current = element;
    let depth = 0;
    while (current && current !== document.body && depth < breadcrumbsMaxDepth) {
      const tag = current.tagName.toLowerCase();
      const identifier =
        current.id || current.getAttribute('data-saas-section') || current.classList?.item(0) || tag;
      const sanitized = sanitizeSegment(identifier);
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
    return segments.join('-') || `${element.tagName.toLowerCase()}-0`;
  };

  const generateStableId = (element) => {
    const existingId = element.getAttribute('data-saas-id');
    if (existingId) return existingId;
    
    const breadcrumb = buildDomBreadcrumb(element);
    // ZMENA: Odstránime "auto-tag-" prefix, necháme len čistú cestu
    const candidate = breadcrumb; 
    
    element.setAttribute('data-saas-id', candidate);
    return candidate;
  };

  const getElementValue = (element) => {
    if (!element) {
      return '';
    }
    if (element.tagName.toLowerCase() === 'img') {
      return (element.getAttribute('src') || '').trim();
    }
    return (element.innerHTML || '').trim();
  };

  const applyValueToElement = (element, value) => {
    if (value === undefined || value === null) {
      return;
    }
    const normalized = value.toString();
    if (element.tagName.toLowerCase() === 'img') {
      element.src = normalized;
    } else {
      element.innerHTML = normalized;
    }
  };

  const collectSiteElements = (host) => {
    const cache = loadLocalCache();
    const seen = new Set();
    const results = [];
    const nodes = Array.from(document.querySelectorAll(selectorQuery));
    withSuppressedMutations(() => {
      nodes.forEach((element) => {
        if (!element.isConnected || !element.tagName) {
          return;
        }
        if (host.contains(element)) {
          return;
        }
        const elementId = generateStableId(element);
        if (!elementId || seen.has(elementId)) {
          return;
        }
        seen.add(elementId);
        const tagName = element.tagName;
        const rawValue = getElementValue(element);
        const cacheEntry =
          cache && Object.prototype.hasOwnProperty.call(cache, elementId)
            ? cache[elementId]
            : null;
        const originalSource =
          cacheEntry && Object.prototype.hasOwnProperty.call(cacheEntry, 'originalValue')
            ? cacheEntry.originalValue
            : rawValue;
        const originalValue = normalizePayloadValue(originalSource).trim();
        const hasCustomValue =
          cacheEntry && Object.prototype.hasOwnProperty.call(cacheEntry, 'value');
        if (hasCustomValue) {
          applyValueToElement(element, cacheEntry.value);
        }
        const currentValue = hasCustomValue
          ? normalizePayloadValue(cacheEntry.value).trim()
          : normalizePayloadValue(getElementValue(element)).trim();
        results.push({
          elementId,
          tagName,
          currentValue,
          originalValue,
          valueType: tagName.toLowerCase() === 'img' ? 'src' : 'text'
        });
      });
    });
    return results;
  };

  const updateElementsFromServer = (elements = []) => {
    if (!Array.isArray(elements) || elements.length === 0 || !observer) {
      return;
    }

    const previousSuppression = suppressMutationObserver;
    const previousUpdatingFlag = isUpdatingFromDB;
    suppressMutationObserver = true;
    isUpdatingFromDB = true;

    observer.disconnect();

    try {
      elements.forEach((entry) => {
        const entryId = entry.element_id || entry.elementId;
        if (!entryId) {
          return;
        }
        const hostElement = document.querySelector(`[data-saas-id="${entryId}"]`);
        if (!hostElement) {
          return;
        }
        const dbValue = normalizePayloadValue(
          entry.current_value ?? entry.currentValue ?? entry.value
        )
          .trim();
        const domValue = normalizePayloadValue(getElementValue(hostElement)).trim();

        if (hostElement.dataset) {
          hostElement.dataset.originalValue = dbValue;
        }

        if (domValue !== dbValue) {
          applyValueToElement(hostElement, dbValue);
        }
      });
    } finally {
      setTimeout(() => {
        suppressMutationObserver = previousSuppression;
        isUpdatingFromDB = previousUpdatingFlag;
        if (observer) {
          observer.observe(document.body, mutationConfig);
        }
      }, 400);
    }

    const hashAfterUpdate = computeElementsHash(elements);
    lastSyncHash = hashAfterUpdate;
  };

  const injectStyles = (root) => {
    if (root.getElementById(styleId)) {
      return;
    }
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = styles;
    root.appendChild(style);
  };

  const buildCard = (item) => {
    const card = document.createElement('article');
    card.className = 'nc-widget__card';

    if (item.image_url) {
      const img = document.createElement('img');
      img.className = 'nc-widget__image';
      img.src = item.image_url;
      img.alt = item.titulok || item.title || 'Image';
      card.appendChild(img);
    }

    const title = document.createElement('strong');
    title.textContent = item.titulok || item.title || 'Untitled';
    card.appendChild(title);

    if (item.podtitulok || item.subtitle) {
      const desc = document.createElement('p');
      desc.textContent = item.podtitulok || item.subtitle;
      card.appendChild(desc);
    }

    if (item.cena || item.price) {
      const price = document.createElement('span');
      price.className = 'nc-widget__price';
      price.textContent = item.cena || item.price;
      card.appendChild(price);
    }

    return card;
  };

  const renderSections = (host, items) => {
    const shadowRoot = host.shadowRoot || host.attachShadow({ mode: 'open' });
    shadowRoot.innerHTML = '';
    injectStyles(shadowRoot);

    const wrapper = document.createElement('div');
    wrapper.className = 'nc-widget';

    const trainers = items.filter((item) => {
      const identifier = (item.typ || item.type || '').toString().toLowerCase();
      return identifier.includes('train');
    });
    const prices = items.filter((item) => {
      const identifier = (item.typ || item.type || '').toString().toLowerCase();
      return identifier.includes('price') || identifier.includes('cen');
    });

    if (trainers.length) {
      const section = document.createElement('section');
      section.className = 'nc-widget__section';
      const heading = document.createElement('h4');
      heading.textContent = 'Tréneri';
      section.appendChild(heading);

      const grid = document.createElement('div');
      grid.className = 'nc-widget__grid';
      trainers.forEach((trainer) => grid.appendChild(buildCard(trainer)));
      section.appendChild(grid);
      wrapper.appendChild(section);
    }

    if (prices.length) {
      const section = document.createElement('section');
      section.className = 'nc-widget__section';
      const heading = document.createElement('h4');
      heading.textContent = 'Cenník';
      section.appendChild(heading);

      const table = document.createElement('table');
      table.className = 'nc-widget__table';
      prices.forEach((priceItem) => {
        const row = document.createElement('tr');
        const label = document.createElement('td');
        label.textContent = priceItem.titulok || priceItem.title || 'Balík';
        const value = document.createElement('td');
        value.textContent = priceItem.cena || priceItem.price || '-';
        row.appendChild(label);
        row.appendChild(value);
        table.appendChild(row);
      });
      section.appendChild(table);
      wrapper.appendChild(section);
    }

    if (!trainers.length && !prices.length) {
      const section = document.createElement('section');
      section.className = 'nc-widget__section';
      const heading = document.createElement('h4');
      heading.textContent = 'Obsah';
      section.appendChild(heading);

      const grid = document.createElement('div');
      grid.className = 'nc-widget__grid';
      items.forEach((item) => grid.appendChild(buildCard(item)));
      section.appendChild(grid);
      wrapper.appendChild(section);
    }

    shadowRoot.appendChild(wrapper);
  };

  const syncSiteStructure = async (clientId, elements) => {
    if (!clientId) {
      return [];
    }

    const payload = {
      clientId,
      elements: Array.isArray(elements)
        ? elements.map((element) => ({
            elementId: element.elementId,
            tagName: element.tagName,
            currentValue: element.currentValue,
            originalValue: element.originalValue,
            valueType: element.valueType
          }))
        : []
    };

    const response = await fetch(syncEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error('Failed to sync site elements');
    }

    const data = await response.json();
    const savedElements = Array.isArray(data.elements) ? data.elements : [];

    // Tieto riadky vykonajú tie opravy, ktoré sme napísali hore
    updateElementsFromServer(savedElements);
    persistLocalCache(savedElements);

    return savedElements;
  };

  const runScan = async () => {
    if (!mapperHost || !mapperClientId) {
      return;
    }
    const elements = collectSiteElements(mapperHost);
    const currentHash = computeElementsHash(elements);
    if (currentHash && currentHash === lastSyncHash) {
      return;
    }
    isScanning = true;
    try {
      const savedElements = await syncSiteStructure(mapperClientId, elements);
      const serverHash = computeElementsHash(savedElements);
      if (serverHash) {
        lastSyncHash = serverHash;
      } else if (currentHash) {
        lastSyncHash = currentHash;
      }
    } catch (error) {
      console.error('Auto mapper sync failed', error);
    } finally {
      isScanning = false;
    }
  };

  const scheduleScan = () => {
    if (scanTimer) {
      return;
    }
    scanTimer = setTimeout(() => {
      scanTimer = null;
      if (isScanning) {
        scheduleScan();
        return;
      }
      runScan().catch((error) => {
        console.error('Auto mapper run failed', error);
      });
    }, 220);
  };

  const startAutoMapper = (host, clientId) => {
    if (!host || !clientId || autoMapperInitialized) {
      return;
    }
    autoMapperInitialized = true;
    mapperHost = host;
    mapperClientId = clientId;
    observer = new MutationObserver(() => {
      if (suppressMutationObserver || isUpdatingFromDB) {
        return;
      }
      scheduleScan();
    });
    observer.observe(document.body, mutationConfig);
    scheduleScan();
  };

  const initWidget = async () => {
    const host = document.querySelector(containerSelector);
    if (!host) {
      return;
    }
    if (host.dataset.nicheCmsWidget === 'loaded') {
      return;
    }
    host.dataset.nicheCmsWidget = 'loading';
    const clientId = host.getAttribute('data-client-id');
    if (!clientId) {
      host.dataset.nicheCmsWidget = 'missing-client';
      return;
    }

    startAutoMapper(host, clientId);

    try {
      const response = await fetch(`${apiBase}/${clientId}`);
      if (!response.ok) {
        throw new Error('Failed to load widget data');
      }
      const items = await response.json();
      renderSections(host, items);
      host.dataset.nicheCmsWidget = 'loaded';
    } catch (error) {
      host.dataset.nicheCmsWidget = 'error';
      console.error('Widget load failed', error);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    initWidget();
  }
})();
