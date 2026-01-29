(function () {
  const containerSelector = '#niche-cms-widget';
  const apiBase = 'http://localhost:3000/api/obsah';

  const createWidgetMarkup = (items) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'nc-widget';

    const grid = document.createElement('div');
    grid.className = 'nc-widget__grid';

    items.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'nc-widget__card';

      const title = document.createElement('strong');
      title.textContent = item.titulok || 'Názov';
      card.appendChild(title);

      if (item.podtitulok) {
        const desc = document.createElement('p');
        desc.textContent = item.podtitulok;
        card.appendChild(desc);
      }

      if (item.cena) {
        const price = document.createElement('span');
        price.textContent = item.cena;
        price.className = 'nc-widget__price';
        card.appendChild(price);
      }

      grid.appendChild(card);
    });

    wrapper.appendChild(grid);
    return wrapper;
  };

  const injectStyles = (root) => {
    if (root.querySelector('#nc-widget-style')) return;
    const style = document.createElement('style');
    style.id = 'nc-widget-style';
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

  async function initWidget() {
    const host = document.querySelector(containerSelector);
    if (!host) return;
    if (host.dataset.widgetStatus === 'loaded') return;

    const clientId = host.getAttribute('data-client-id');
    if (!clientId) return;

    try {
      const response = await fetch(`${apiBase}/${clientId}`);
      if (!response.ok) {
        throw new Error('Failed to load widget data');
      }

      const items = await response.json();
      const shadowRoot = host.shadowRoot || host.attachShadow({ mode: 'open' });
      injectStyles(shadowRoot);
      const widgetMarkup = createWidgetMarkup(items);
      shadowRoot.appendChild(widgetMarkup);

      host.dataset.widgetStatus = 'loaded';
    } catch (error) {
      console.error('Widget load failed', error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    initWidget();
  }
})();
