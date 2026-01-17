import { AnomalyPoint, TrendAnalysis } from '../types';

/**
 * Detect anomalies in a data series using statistical methods
 * Uses IQR (Interquartile Range) method for outlier detection
 */
export function detectAnomalies(
  data: number[],
  labels?: string[],
  sensitivity: 'low' | 'medium' | 'high' = 'medium'
): AnomalyPoint[] {
  if (data.length < 4) return [];

  // Calculate quartiles
  const sorted = [...data].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;

  // Sensitivity multipliers
  const multipliers = { low: 2.5, medium: 1.5, high: 1.0 };
  const k = multipliers[sensitivity];

  const lowerBound = q1 - k * iqr;
  const upperBound = q3 + k * iqr;

  // Calculate mean for deviation calculation
  const mean = data.reduce((a, b) => a + b, 0) / data.length;

  const anomalies: AnomalyPoint[] = [];

  data.forEach((value, index) => {
    if (value < lowerBound || value > upperBound) {
      const deviation = Math.abs(value - mean) / (iqr || 1);
      let severity: 'low' | 'medium' | 'high' = 'low';
      
      if (deviation > 3) severity = 'high';
      else if (deviation > 2) severity = 'medium';

      anomalies.push({
        index,
        value,
        expectedValue: mean,
        deviation: ((value - mean) / mean) * 100,
        severity,
        message: `${labels?.[index] || `Point ${index + 1}`}: ${value.toLocaleString()} is ${
          value > upperBound ? 'unusually high' : 'unusually low'
        } (${deviation.toFixed(1)}σ from mean)`
      });
    }
  });

  return anomalies;
}

/**
 * Analyze trend in a time series data
 */
export function analyzeTrend(
  data: number[],
  periodLabel: string = 'period'
): TrendAnalysis {
  if (data.length < 2) {
    return { direction: 'stable', percentageChange: 0, period: periodLabel, confidence: 0 };
  }

  // Simple linear regression
  const n = data.length;
  const xMean = (n - 1) / 2;
  const yMean = data.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (data[i] - yMean);
    denominator += (i - xMean) ** 2;
  }

  const slope = numerator / denominator;
  const percentageChange = ((data[n - 1] - data[0]) / data[0]) * 100;

  // Calculate R-squared for confidence
  const yPredicted = data.map((_, i) => yMean + slope * (i - xMean));
  const ssRes = data.reduce((sum, val, i) => sum + (val - yPredicted[i]) ** 2, 0);
  const ssTot = data.reduce((sum, val) => sum + (val - yMean) ** 2, 0);
  const rSquared = 1 - ssRes / ssTot;

  let direction: 'up' | 'down' | 'stable' = 'stable';
  if (Math.abs(percentageChange) > 5) {
    direction = percentageChange > 0 ? 'up' : 'down';
  }

  return {
    direction,
    percentageChange,
    period: periodLabel,
    confidence: Math.max(0, Math.min(1, rSquared))
  };
}

/**
 * Perform comparative analysis between two data series
 */
export function compareDataSeries(
  currentData: number[],
  previousData: number[],
  labels?: string[]
): {
  totalChange: number;
  averageChange: number;
  bestPerformer: { label: string; change: number };
  worstPerformer: { label: string; change: number };
  improvements: number;
  declines: number;
} {
  const changes = currentData.map((current, i) => {
    const previous = previousData[i] || 0;
    return previous === 0 ? 0 : ((current - previous) / previous) * 100;
  });

  const totalCurrent = currentData.reduce((a, b) => a + b, 0);
  const totalPrevious = previousData.reduce((a, b) => a + b, 0);
  const totalChange = totalPrevious === 0 ? 0 : ((totalCurrent - totalPrevious) / totalPrevious) * 100;

  const averageChange = changes.reduce((a, b) => a + b, 0) / changes.length;

  const maxChangeIndex = changes.indexOf(Math.max(...changes));
  const minChangeIndex = changes.indexOf(Math.min(...changes));

  return {
    totalChange,
    averageChange,
    bestPerformer: {
      label: labels?.[maxChangeIndex] || `Item ${maxChangeIndex + 1}`,
      change: changes[maxChangeIndex]
    },
    worstPerformer: {
      label: labels?.[minChangeIndex] || `Item ${minChangeIndex + 1}`,
      change: changes[minChangeIndex]
    },
    improvements: changes.filter(c => c > 0).length,
    declines: changes.filter(c => c < 0).length
  };
}

/**
 * Calculate moving average for smoothing data
 */
export function calculateMovingAverage(data: number[], window: number = 3): number[] {
  if (data.length < window) return data;

  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - Math.floor(window / 2));
    const end = Math.min(data.length, i + Math.ceil(window / 2));
    const slice = data.slice(start, end);
    result.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  return result;
}

/**
 * Simple forecast using exponential smoothing
 */
export function forecastNextValues(
  data: number[],
  periodsAhead: number = 3,
  alpha: number = 0.3
): number[] {
  if (data.length === 0) return [];

  // Simple exponential smoothing
  let smoothed = data[0];
  for (let i = 1; i < data.length; i++) {
    smoothed = alpha * data[i] + (1 - alpha) * smoothed;
  }

  // Calculate trend
  const trend = data.length >= 2 ? (data[data.length - 1] - data[0]) / (data.length - 1) : 0;

  const forecast: number[] = [];
  for (let i = 1; i <= periodsAhead; i++) {
    forecast.push(smoothed + trend * i);
  }

  return forecast;
}

/**
 * Generate query optimization suggestions based on SQL analysis
 */
export function generateQueryOptimizationSuggestions(sql: string): string[] {
  const suggestions: string[] = [];
  const sqlLower = sql.toLowerCase();

  // Check for SELECT *
  if (sqlLower.includes('select *')) {
    suggestions.push('Consider specifying columns instead of SELECT * to reduce data transfer and improve performance.');
  }

  // Check for missing WHERE clause in large table scans
  if (!sqlLower.includes('where') && (sqlLower.includes('from') && !sqlLower.includes('limit'))) {
    suggestions.push('Consider adding a WHERE clause or LIMIT to prevent full table scans.');
  }

  // Check for functions in WHERE clause
  if (sqlLower.match(/where\s+.*\b(lower|upper|date|year|month)\s*\(/)) {
    suggestions.push('Avoid using functions on columns in WHERE clause as it prevents index usage. Consider creating computed columns.');
  }

  // Check for LIKE with leading wildcard
  if (sqlLower.match(/like\s+['"]%/)) {
    suggestions.push('Leading wildcard in LIKE pattern (e.g., LIKE "%term") cannot use indexes. Consider full-text search.');
  }

  // Check for missing index hints on JOINs
  if (sqlLower.includes('join') && !sqlLower.includes('index')) {
    suggestions.push('Ensure JOIN columns are indexed for optimal performance.');
  }

  // Check for ORDER BY without LIMIT
  if (sqlLower.includes('order by') && !sqlLower.includes('limit')) {
    suggestions.push('ORDER BY without LIMIT sorts the entire result set. Consider adding LIMIT if you only need top results.');
  }

  // Check for subqueries that could be JOINs
  if (sqlLower.match(/where.*in\s*\(select/)) {
    suggestions.push('Subqueries with IN clause can often be rewritten as JOINs for better performance.');
  }

  // Check for multiple OR conditions
  if ((sqlLower.match(/\bor\b/g) || []).length > 2) {
    suggestions.push('Multiple OR conditions may prevent index usage. Consider using UNION or IN clause.');
  }

  // Check for DISTINCT
  if (sqlLower.includes('distinct')) {
    suggestions.push('DISTINCT can be expensive. Ensure it\'s necessary or consider GROUP BY with appropriate indexes.');
  }

  return suggestions;
}
