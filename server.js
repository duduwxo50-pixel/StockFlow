const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// ── Configuración OAuth ──
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID || '';
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET || '';
const HOST = process.env.HOST || 'https://stockflow-production-822a.up.railway.app';
const SCOPES = 'read_products,write_products,read_inventory,write_inventory,read_locations';

// Almacén temporal de tokens (en producción usar una base de datos)
const tokenStore = {};

// ── OAuth: Iniciar flujo ──
app.get('/auth', (req, res) => {
  const shop = req.query.shop;
  if (!shop) return res.status(400).send('Falta el parámetro shop');

  const state = crypto.randomBytes(16).toString('hex');
  const redirectUri = `${HOST}/auth/callback`;
  const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${CLIENT_ID}&scope=${SCOPES}&redirect_uri=${redirectUri}&state=${state}`;
  
  res.redirect(authUrl);
});

// ── OAuth: Callback ──
app.get('/auth/callback', async (req, res) => {
  const { shop, code, state } = req.query;

  if (!shop || !code) return res.status(400).send('Parámetros inválidos');

  try {
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code })
    });

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) return res.status(400).send('No se pudo obtener el token');

    // Guardar token asociado a la tienda
    const storeName = shop.replace('.myshopify.com', '');
    tokenStore[storeName] = accessToken;

    // Redirigir al frontend con la tienda conectada
    res.redirect(`/?connected=true&shop=${storeName}`);
  } catch (e) {
    res.status(500).send('Error en callback: ' + e.message);
  }
});

// ── Endpoint para obtener el token desde el frontend ──
app.get('/api/token', (req, res) => {
  const { shop } = req.query;
  const token = tokenStore[shop];
  if (!token) return res.status(404).json({ error: 'Tienda no conectada' });
  res.json({ token });
});

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
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' }
    });

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
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
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
