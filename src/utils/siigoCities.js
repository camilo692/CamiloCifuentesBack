const CITY_CODES = {
  bogota: { country_code: 'CO', state_code: '11', city_code: '11001' },
  'bogota d.c': { country_code: 'CO', state_code: '11', city_code: '11001' },
  'bogota dc': { country_code: 'CO', state_code: '11', city_code: '11001' },
  medellin: { country_code: 'CO', state_code: '05', city_code: '05001' },
  cali: { country_code: 'CO', state_code: '76', city_code: '76001' },
  barranquilla: { country_code: 'CO', state_code: '08', city_code: '08001' },
  cartagena: { country_code: 'CO', state_code: '13', city_code: '13001' },
  bucaramanga: { country_code: 'CO', state_code: '68', city_code: '68001' },
  pereira: { country_code: 'CO', state_code: '66', city_code: '66001' },
  manizales: { country_code: 'CO', state_code: '17', city_code: '17001' },
  cucuta: { country_code: 'CO', state_code: '54', city_code: '54001' },
  'santa marta': { country_code: 'CO', state_code: '47', city_code: '47001' },
  ibague: { country_code: 'CO', state_code: '73', city_code: '73001' },
  villavicencio: { country_code: 'CO', state_code: '50', city_code: '50001' },
  pasto: { country_code: 'CO', state_code: '52', city_code: '52001' },
  armenia: { country_code: 'CO', state_code: '63', city_code: '63001' },
  neiva: { country_code: 'CO', state_code: '41', city_code: '41001' },
  popayan: { country_code: 'CO', state_code: '19', city_code: '19001' },
  sincelejo: { country_code: 'CO', state_code: '70', city_code: '70001' },
  tunja: { country_code: 'CO', state_code: '15', city_code: '15001' },
  valledupar: { country_code: 'CO', state_code: '20', city_code: '20001' },
  monteria: { country_code: 'CO', state_code: '23', city_code: '23001' },
};

function normalizeCityName(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\./g, '')
    .trim();
}

function getSiigoCityCodes(ciudad, departamento) {
  const cityKey = normalizeCityName(ciudad);
  if (CITY_CODES[cityKey]) return CITY_CODES[cityKey];

  const deptKey = normalizeCityName(departamento);
  if (deptKey.includes('bogota') || cityKey.includes('bogota')) {
    return CITY_CODES.bogota;
  }

  return CITY_CODES.bogota;
}

module.exports = {
  getSiigoCityCodes,
};
