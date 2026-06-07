export function formatMetricNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatMetricPercent(value: number) {
  return `${formatMetricNumber(value * 100)}%`;
}
