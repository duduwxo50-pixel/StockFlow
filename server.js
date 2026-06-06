const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// ── Proxy genérico para Shopify Admin API ──
app.get('/api/shopify/:endpoint(*)', async (req, res) => {
  const { storeName, token } = req.query;
  const { endpoint } = req.params;

  if (!storeName || !token) {
    return res.status(400).json({ error: 'Faltan storeName o token' });
  }

  try {
    const url = `https://${storeName}.myshopify.com/admin/api/2024-01/${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Actualizar inventario ──
app.post('/api/shopify/inventory', async (req, res) => {
  const { storeName, token, inventoryItemId, locationId, available } = req.body;
  try {
    const url = `https://${storeName}.myshopify.com/admin/api/2024-01/inventory_levels/set.json`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ inventory_item_id: inventoryItemId, location_id: locationId, available })
    });
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`StockFlow server corriendo en puerto ${PORT}`));
