require('dotenv').config();

const BASE_URL = 'https://api.siigo.com';

async function authenticate() {
  const response = await fetch(`${BASE_URL}/auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Partner-Id': process.env.SIIGO_PARTNER_ID,
    },
    body: JSON.stringify({
      username: process.env.SIIGO_USERNAME,
      access_key: process.env.SIIGO_ACCESS_KEY,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Auth ${response.status}: ${JSON.stringify(data)}`);
  }

  return data.access_token;
}

async function getJson(path, token) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Partner-Id': process.env.SIIGO_PARTNER_ID,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${path} ${response.status}: ${JSON.stringify(data)}`);
  }

  return data;
}

function summarize(title, rows, mapper) {
  console.log(`\n=== ${title} ===`);
  if (!Array.isArray(rows) || rows.length === 0) {
    console.log('Sin resultados');
    return;
  }
  rows.slice(0, 20).forEach((row) => console.log(mapper(row)));
  if (rows.length > 20) {
    console.log(`... ${rows.length - 20} más`);
  }
}

async function main() {
  if (!process.env.SIIGO_USERNAME || !process.env.SIIGO_ACCESS_KEY || !process.env.SIIGO_PARTNER_ID) {
    throw new Error('Faltan SIIGO_USERNAME, SIIGO_ACCESS_KEY o SIIGO_PARTNER_ID en .env');
  }

  const token = await authenticate();
  console.log('Autenticación Siigo OK');

  const [documents, users, payments, products, taxes] = await Promise.all([
    getJson('/v1/document-types?type=FV', token),
    getJson('/v1/users', token),
    getJson('/v1/payment-types?document_type=FV', token),
    getJson('/v1/products?page=1&page_size=20', token),
    getJson('/v1/taxes', token).catch((err) => ({ error: err.message })),
  ]);

  summarize('Tipos de comprobante (SIIGO_DOCUMENT_ID)', documents, (d) =>
    `id=${d.id}  code=${d.code || '-'}  name=${d.name || d.description || '-'}`
  );

  const userList = Array.isArray(users) ? users : users.results || [];
  summarize('Usuarios / vendedores (SIIGO_SELLER_ID)', userList, (u) =>
    `id=${u.id}  name=${u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim()}  email=${u.email || '-'}`
  );

  summarize('Formas de pago (SIIGO_PAYMENT_TYPE_ID)', payments, (p) =>
    `id=${p.id}  name=${p.name}  type=${p.type}  active=${p.active}  due_date=${p.due_date}`
  );

  const productList = Array.isArray(products) ? products : products.results || [];
  summarize('Productos (SIIGO_PRODUCT_CODE)', productList, (p) =>
    `code=${p.code}  name=${p.name || p.description || '-'}  active=${p.active}`
  );

  const taxList = Array.isArray(taxes) ? taxes : taxes.results || [];
  if (taxes.error) {
    console.log('\n=== Impuestos (SIIGO_TAX_ID) ===');
    console.log(taxes.error);
  } else {
    summarize('Impuestos (SIIGO_TAX_ID)', taxList, (t) =>
      `id=${t.id}  name=${t.name || t.description || '-'}  type=${t.type || '-'}  percentage=${t.percentage ?? '-'}`
    );
  }
}

main().catch((error) => {
  console.error('\nNo se pudo consultar Siigo:');
  console.error(error.message);
  process.exit(1);
});
