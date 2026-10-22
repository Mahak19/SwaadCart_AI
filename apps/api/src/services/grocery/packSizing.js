export function packSizeFor(qty, packSizes = []) {
  if (!packSizes.length) return { qty, priceINR: Math.round(qty * 0.05) };
  let best = packSizes[0];
  for (const p of packSizes) {
    if (p.qty >= qty && (best.qty < qty || p.qty < best.qty)) best = p;
  }
  return best;
}

export function estimatePrice(qty, packSizes = [], avgPerUnit = 0.05) {
  const pack = packSizeFor(qty, packSizes);
  const packs = Math.ceil(qty / (pack.qty || 1));
  return packs * (pack.priceINR || Math.round(qty * avgPerUnit));
}
