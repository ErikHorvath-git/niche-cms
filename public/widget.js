(async function() {
    const container = document.getElementById('diamond-widget');
    if (!container) return;

    const clientId = container.getAttribute('data-client');
    
    // Pridáme Diamond Gym štýl (tmavý, zlaté prvky)
    const style = document.createElement('style');
    style.textContent = `
        .dg-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; font-family: sans-serif; }
        .dg-card { background: #111; border: 1px solid #333; padding: 20px; border-radius: 12px; color: white; transition: 0.3s; }
        .dg-card:hover { border-color: #f3ca33; }
        .dg-title { margin: 0 0 10px 0; text-transform: uppercase; font-size: 1.1rem; }
        .dg-price { color: #f3ca33; font-size: 1.4rem; font-weight: bold; display: block; margin-top: 10px; }
    `;
    document.head.appendChild(style);

    try {
        const res = await fetch(`/api/obsah/${clientId}`);
        const data = await res.json();

        container.innerHTML = `
            <div class="dg-container">
                ${data.map(item => `
                    <div class="dg-card">
                        <h3 class="dg-title">${item.titulok}</h3>
                        <p style="color: #ccc; font-size: 0.9rem;">${item.podtitulok || ''}</p>
                        <span class="dg-price">${item.cena || ''}</span>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (e) {
        console.error("Chyba Diamond Widgetu:", e);
    }
})();