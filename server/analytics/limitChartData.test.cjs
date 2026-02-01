const test = require('node:test');
const assert = require('node:assert/strict');
const { limitChartData } = require('./limitChartData');

test('limitChartData trims categorical to top 12', () => {
  const chartData = Array.from({ length: 20 }, (_, idx) => ({ label: `L${idx}`, value: idx + 1 }));
  const result = limitChartData(chartData, { type: 'bar', xAxis: 'label', yAxis: 'value' });
  assert.equal(result.length, 12);
  assert.equal(result[0].value, 20);
});

test('limitChartData down-samples time series to 24 points', () => {
  const chartData = Array.from({ length: 48 }, (_, idx) => ({ t: idx, v: idx }));
  const result = limitChartData(chartData, { type: 'line', xAxis: 't', yAxis: 'v' });
  assert.equal(result.length, 24);
});
