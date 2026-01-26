function limitChartData(chartData, chartConfig) {
  if (!Array.isArray(chartData) || chartData.length === 0 || !chartConfig) return chartData;

  const type = chartConfig.type;
  const xAxis = chartConfig.xAxis;
  const yAxis = chartConfig.yAxis;

  const isCategorical = ['bar', 'pie', 'radar', 'composed'].includes(type);
  const isSeries = ['line', 'area'].includes(type);

  if (isCategorical && chartData.length > 12) {
    const sorted = [...chartData].sort((a, b) => {
      const aVal = Number(a?.[yAxis]) || 0;
      const bVal = Number(b?.[yAxis]) || 0;
      return bVal - aVal;
    });
    return sorted.slice(0, 12);
  }

  if (isSeries && chartData.length > 24) {
    const step = Math.ceil(chartData.length / 24);
    return chartData.filter((_, idx) => idx % step === 0);
  }

  return chartData;
}

module.exports = {
  limitChartData
};
