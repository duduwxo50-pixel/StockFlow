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
    
    let headers = { 'Content-Type': 'application/json' };
    
    // Soporta formato "apiKey:secret" (autenticación básica heredada)
    // o token directo shpat_/atkn_
    if (token.includes(':')) {
      const [apiKey, secret] = token.split(':');
      const basic = Buffer.from(`${apiKey}:${secret}`).toString('base64');
      headers['Authorization'] = `Basic ${basic}`;
    } else {
      headers['X-Shopify-Access-Token'] = token;
    }

    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText });
    }
    
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
    
    let headers = { 'Content-Type': 'application/json' };
    if (token.includes(':')) {
      const [apiKey, secret] = token.split(':');
      const basic = Buffer.from(`${apiKey}:${secret}`).toString('base64');
      headers['Authorization'] = `Basic ${basic}`;
    } else {
      headers['X-Shopify-Access-Token'] = token;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
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
