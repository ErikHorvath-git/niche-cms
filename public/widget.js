(function () {
  const containerSelector = '#niche-cms-widget';
  const apiBase = 'http://localhost:3000/api/obsah';
  const syncEndpoint = 'http://localhost:3000/api/sync-schema';
  const styleId = 'nc-widget-style';

  const styles = `
    .nc-widget { font-family: 'Inter', system-ui, sans-serif; color: #f8f8f8; }
    .nc-widget__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-top: 1rem; }
    .nc-widget__card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 1rem; box-shadow: 0 20px 45px rgba(0,0,0,0.25); }
    .nc-widget__card strong { display: block; margin-bottom: 0.5rem; font-size: 1rem; }
    .nc-widget__card p { margin: 0; color: #c6c6c6; font-size: 0.9rem; }
    .nc-widget__price { color: #f3ca33; font-weight: 700; margin-top: 0.5rem; display: block; }
    .nc-widget__image { width: 100%; height: auto; border-radius: 12px; margin-bottom: 0.75rem; object-fit: cover; }
    .nc-widget__section { margin-bottom: 1.5rem; }
    .nc-widget__section h4 { margin: 0 0 0.5rem; font-size: 1.15rem; letter-spacing: 0.05em; text-transform: uppercase; }
    .nc-widget__table { width: 100%; border-collapse: collapse; margin-top: 0.75rem; }
    .nc-widget__table td { padding: 0.45rem 0; border-bottom: 1px solid rgba(255,255,255,0.1); }
    .nc-widget__table td:first-child { color: #c6c6c6; font-size: 0.85rem; }
  `;

  const injectStyles = (root) => {
    if (root.getElementById(styleId)) return;
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
    injectStyles(shadowRoot);
    shadowRoot.innerHTML = '';

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

  const collectSiteElements = () => {
    return Array.from(document.querySelectorAll('[data-saas-id]'))
      .map((element) => {
        const elementId = element.getAttribute('data-saas-id');
        if (!elementId) return null;
        return {
          elementId,
          currentText: element.innerHTML,
          tagName: element.tagName
        };
      })
      .filter(Boolean);
  };

  const syncSiteStructure = async (clientId, elements) => {
    if (!elements.length) return [];
    const response = await fetch(syncEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ clientId, elements })
    });

    if (!response.ok) {
      throw new Error('Failed to sync site structure');
    }

    const data = await response.json();
    (data.elements || []).forEach((entry) => {
      if (!entry.element_id || !entry.current_value) return;
      const hostElement = document.querySelector(`[data-saas-id="${entry.element_id}"]`);
      if (hostElement) {
        hostElement.innerHTML = entry.current_value;
      }
    });

    return data.elements || [];
  };

  const initWidget = async () => {
    const host = document.querySelector(containerSelector);
    if (!host) return;
    const clientId = host.getAttribute('data-client-id');
    if (!clientId) return;

    try {
      const response = await fetch(`${apiBase}/${clientId}`);
      if (!response.ok) throw new Error('Failed to load widget data');
      const items = await response.json();
      renderSections(host, items);
      await syncSiteStructure(clientId, collectSiteElements());
    } catch (error) {
      console.error('Widget load failed', error);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    initWidget();
  }
})();
