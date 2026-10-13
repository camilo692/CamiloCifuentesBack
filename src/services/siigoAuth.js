const { getSiigoConfig } = require('../config/siigo');

let cachedToken = null;
let tokenExpiresAt = 0;

async function autenticarSiigo() {
  const { baseUrl, username, accessKey, partnerId } = getSiigoConfig();

  const response = await fetch(`${baseUrl}/auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Partner-Id': partnerId,
    },
    body: JSON.stringify({
      username,
      access_key: accessKey,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `Error de autenticación Siigo: ${response.status}${detail ? ` - ${detail}` : ''}`
    );
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    tokenType: data.token_type || 'Bearer',
  };
}

async function getSiigoAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  const { accessToken, expiresIn } = await autenticarSiigo();
  cachedToken = accessToken;
  tokenExpiresAt = now + Math.max(30, Number(expiresIn || 86400) - 60) * 1000;
  return cachedToken;
}

function clearSiigoToken() {
  cachedToken = null;
  tokenExpiresAt = 0;
}

module.exports = {
  autenticarSiigo,
  getSiigoAccessToken,
  clearSiigoToken,
};
