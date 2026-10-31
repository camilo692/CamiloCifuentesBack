const IVA_RATE = 0.19;
const COSTO_ENVIO = 18000;

function calcIva(subtotal) {
  return Math.round(Number(subtotal || 0) * IVA_RATE);
}

function calcOrderTotals(subtotal) {
  const safeSubtotal = Math.round(Number(subtotal || 0));
  const iva = calcIva(safeSubtotal);
  const envio = safeSubtotal > 0 ? COSTO_ENVIO : 0;
  return {
    subtotal: safeSubtotal,
    iva,
    envio,
    total: safeSubtotal + iva + envio,
  };
}

module.exports = {
  IVA_RATE,
  COSTO_ENVIO,
  calcIva,
  calcOrderTotals,
};
