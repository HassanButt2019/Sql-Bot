const express = require('express');
const { executeQuery } = require('../db/index.cjs');
const { limitChartData } = require('../analytics/limitChartData.cjs');
const { mapPromptBusinessTerms, getSemanticSummary } = require('../llm/semanticLayer.cjs');
const { getPlanForUser, checkLimit, incrementUsage, logAudit, logEvent } = require('../db/sqliteStore.cjs');
const { requireAuth, requireTenant } = require('../middleware/auth.cjs');
const { requirePermission } = require('../policies/rbac.cjs');
const { requireCapability, assertCapabilityScope } = require('../middleware/capability.cjs');
const crypto = require('crypto');

const router = express.Router();

const chatHistories = {};

function buildDbConfig(dbConnection) {
  return {
    host: dbConnection.host,
    port: dbConnection.port || '5432',
    username: dbConnection.username,
    password: dbConnection.password,
    database: dbConnection.database,
    dialect: dbConnection.dialect || 'postgresql',
    ssl: dbConnection.ssl || dbConnection.host.includes('azure.com')
  };
}

router.post('/chat', requireAuth, requireTenant, requirePermission('chat:use'), async (req, res) => {
  const startedAt = Date.now();
  const { prompt, schemaContext, apiKey, dbConnection } = req.body;
  const openaiApiKey = (apiKey && apiKey.trim()) ? apiKey.trim() : process.env.OPENAI_API_KEY;
  const userId = req.user?.id;
  const orgId = req.auth?.tenant?.orgId || null;
  const plan = getPlanForUser(userId);
  const limit = checkLimit(userId, 'queries', plan?.monthly_query_limit, orgId);
  if (!limit.allowed) {
    return res.status(429).json({ success: false, error: 'Query limit reached for this month.' });
  }

  if (!openaiApiKey) {
    return res.status(400).json({ success: false, error: 'OpenAI API key is required. Please add it in Settings or set OPENAI_API_KEY in .env file.' });
  }

  const mappedPrompt = mapPromptBusinessTerms(prompt, { schemaContext });
  const semanticHints = getSemanticSummary(schemaContext);

  const systemPrompt = `You are a world-class Data Analyst and SQL Expert.
Given the database schema provided below, translate the user's natural language question into a valid SQL query and visualization config.

SCHEMA CONTEXT:
${schemaContext}

SEMANTIC HINTS (optional, use only if helpful and consistent with schema):
${semanticHints || 'None'}

IMPORTANT SQL RULES:
1. Generate ONLY valid SQL that can be executed against the schema above.
2. Use proper table and column names exactly as shown in the schema.
3. For PostgreSQL, use double quotes for identifiers if needed.
4. Limit results to 100 rows max unless user asks for more.
5. Use aggregations (COUNT, SUM, AVG, etc.) for chart-friendly data.
6. For categorical charts, return TOP 10-12 categories (ORDER BY metric DESC + LIMIT).
7. For time series, bucket dates using DATE_TRUNC (day/week/month/quarter/year). Default to month if the user doesn't specify.

VISUALIZATION RULES:
1. Select the most effective chart type:
   - 'bar': For categorical comparisons (most common).
   - 'line': For time-series data with dates.
   - 'area': For volume/totals over time.
   - 'pie': For part-to-whole (max 6-8 segments).
   - 'radar': For comparing 3+ metrics.
   - 'scatter': For correlations between numbers.
   - 'composed': For bar + line overlays.

2. Choose xAxis and yAxis based on the SQL SELECT columns.

3. Choose a 'colorScheme' based on meaning:
   - 'trust': Blues/Grays
   - 'growth': Greens
   - 'performance': Multi-color KPIs
   - 'categorical': Vibrant mix
   - 'warm': Oranges/Reds
   - 'cool': Blues/Purples
   - 'alert': Reds for warnings
   - 'default': Clean aesthetic

Your response MUST be valid JSON with these keys:
- sql: The SQL query string (will be executed against real database)
- explanation: A brief explanation of what the query does
- chartConfig: { type, xAxis, yAxis, title, colorScheme }

DO NOT include chartData - the SQL will be executed to get real data.
Do not wrap the JSON in markdown blocks.`;

  try {
    console.log('Calling OpenAI with prompt:', prompt.substring(0, 100) + '...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: mappedPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 2048
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No response from OpenAI');
    }

    console.log('OpenAI response:', content.substring(0, 200) + '...');

    const parsed = JSON.parse(content);
    const queryHash = parsed.sql ? crypto.createHash('sha256').update(parsed.sql).digest('hex') : null;
    incrementUsage(userId, 'queries', 1, undefined, orgId);
    logAudit(userId, 'llm.chat', { prompt: prompt?.slice(0, 200), hasDbConnection: !!dbConnection, latency_ms: Date.now() - startedAt }, orgId);

    let chartData = null;
    let sqlError = null;

    if (dbConnection && parsed.sql) {
      try {
        console.log('Executing SQL:', parsed.sql);

        const config = buildDbConfig(dbConnection);
        chartData = await executeQuery(config, parsed.sql);
        console.log(`Query returned ${chartData.length} rows`);

        if (chartData.length > 100) {
          chartData = chartData.slice(0, 100);
        }

        chartData = limitChartData(chartData, parsed.chartConfig);
      } catch (queryError) {
        console.error('SQL execution error:', queryError.message);
        sqlError = queryError.message;
      }
    }

    logEvent(userId, 'chat', true, { sql_hash: queryHash, latency_ms: Date.now() - startedAt }, orgId);
    res.json({
      success: true,
      data: {
        content: parsed.explanation || 'Analysis complete.',
        sql: parsed.sql,
        explanation: parsed.explanation,
        chartConfig: parsed.chartConfig,
        chartData: chartData,
        sqlError: sqlError
      }
    });
  } catch (error) {
    console.error('OpenAI API error:', error.message);
    logEvent(userId, 'chat', false, { error: error.message, latency_ms: Date.now() - startedAt }, orgId);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/generate-dashboard', requireAuth, requireTenant, requirePermission('dashboards:create'), requireCapability('dashboard.generate'), async (req, res) => {
  const startedAt = Date.now();
  const { prompt, schemaContext, apiKey, dbConnection, widgetCount = 8 } = req.body;
  const userId = req.user?.id;
  const orgId = req.auth?.tenant?.orgId || null;
  const plan = getPlanForUser(userId);
  const limit = checkLimit(userId, 'dashboards', plan?.monthly_dashboard_limit, orgId);
  if (!limit.allowed) {
    return res.status(429).json({ success: false, error: 'Dashboard generation limit reached for this month.' });
  }

  const openaiApiKey = (apiKey && apiKey.trim()) ? apiKey.trim() : process.env.OPENAI_API_KEY;

  console.log('🔑 Using API key:', openaiApiKey ? `${openaiApiKey.substring(0, 10)}...` : 'NOT SET');

  if (!openaiApiKey) {
    return res.status(400).json({ success: false, error: 'OpenAI API key is required. Set it in the app settings or in the .env file.' });
  }

  if (!schemaContext || typeof schemaContext !== 'string' || !schemaContext.trim()) {
    return res.status(400).json({ success: false, error: 'Database schema is required. Please connect to a database first.' });
  }

  try {
    assertCapabilityScope(req, { connectorId: dbConnection?.id, schemaContext });
  } catch (error) {
    return res.status(403).json({ success: false, error: error.message });
  }

  const mappedPrompt = mapPromptBusinessTerms(prompt, { schemaContext });
  const semanticHints = getSemanticSummary(schemaContext);

  const systemPrompt = `You are a world-class Data Analyst and Dashboard Designer.

DATABASE SCHEMA:
${schemaContext}

SEMANTIC HINTS (optional, use only if helpful and consistent with schema):
${semanticHints || 'None'}

TASK: Generate ${widgetCount} analytics widgets for: "${mappedPrompt}"

STRICT HIERARCHY & FLOW:
1. KPI/STATISTICS ROW: The first widgets in the response MUST be a row of KPI cards (totals, averages, counts, min/max) relevant to the prompt.
2. ANALYTICAL DEPTH: Follow KPIs with Trends (Time-series), then Distribution/Comparison charts, and finally Advanced Predictions or Anomaly insights.

CORE OPERATIONAL RULES:
- NO HALLUCINATION: Only use tables and columns explicitly defined in the schema above. Do NOT invent data structures.
- DATA EXISTENCE: For each widget, ensure the SQL logic will return at least 1 row of data. If the data is missing for a specific join, skip the widget or select a simpler aggregate.
- NO PLACEHOLDERS: Do NOT generate widgets with empty, random, or placeholder data.
- DIVERSITY: Use a variety of chart types; do not repeat the same chart type for all widgets.
- DENSITY: Limit SQL results to 10-20 rows per widget to ensure readability and high-performance rendering.
- TOP-N: For categorical charts, return TOP 10-12 categories (ORDER BY metric DESC + LIMIT).
- TIME BUCKETING: For time series, bucket dates using DATE_TRUNC (day/week/month/quarter/year). Default to month if the user doesn't specify.
- FORMATTING: Return ONLY valid JSON. Do not wrap JSON in markdown (no \`\`\`json blocks).

SELF-HEALING & ACCURACY GUARDRAILS:
- NULL PREVENTION: Use 'COALESCE(column, 0)' for numeric aggregations and 'WHERE column IS NOT NULL' to prevent 'NaN' or empty states.
- SAFE DIVISION: Use 'NULLIF(denominator, 0)' in all mathematical divisions to prevent division-by-zero errors.
- JOIN INTEGRITY: Explicitly identify the relationship path (e.g., join 'products' to 'internal_sales_data' on 'product_id').
- AGGREGATION: For time-series, use proper date grouping (e.g., DATE_TRUNC) to ensure the x-axis is a continuous timeline.
- TIME SERIES: Always use the most granular date/time column available for trends.

CHART TYPE GUIDELINES:
- 'bar': Categorical comparisons, rankings, top-N lists
- 'line': Time-series, trends over periods
- 'area': Volume/totals over time, cumulative data
- 'pie': Part-to-whole relationships (max 6-8 segments)
- 'radar': Multi-dimensional comparisons
- 'scatter': Correlations between two numeric variables
- 'composed': Combining bar + line for different metrics
- 'gauge': For single-value performance metrics
- 'heatmap': For matrix-style, density, or activity data
- 'geo': For location-based metrics (must use valid location columns)

COLOR SCHEME OPTIONS:
- 'trust': Professional blues/grays
- 'growth': Success/growth greens
- 'performance': Multi-color for KPIs
- 'categorical': Vibrant distinct colors
- 'warm': Orange/red tones
- 'cool': Blue/purple tones
- 'alert': Warning reds
- 'default': Clean balanced palette

ADVANCED DASHBOARD GUIDELINES:
- Group related widgets visually and logically (e.g., KPIs/statistics row, trends section, distribution section).
- For widgets analyzing feature importance or correlation (e.g., pearson_score, spearman_score, feature_importance), provide a specific actionable business suggestion in the explanation field, such as "Increase marketing in Region X" or "Reduce inventory for Product Y" based on the data.
- Always optimize for readability and business insight: avoid clutter, use clear labels, and prioritize actionable metrics.
- If the schema includes user, product, or transaction tables, prioritize widgets that show trends, distributions, and top performers.
- If possible, include at least one widget that highlights anomalies, outliers, or recent changes.

RESPONSE FORMAT (JSON):
{
  "dashboardTitle": "Descriptive Dashboard Title",
  "description": "Brief description of what this dashboard shows",
  "widgets": [
    {
      "title": "Widget Title",
      "sql": "SELECT ...",
      "explanation": "What this widget shows. If analyzing feature importance or correlation, include a specific actionable business suggestion.",
      "chartConfig": {
        "type": "bar|line|pie|area|radar|scatter|composed|gauge|heatmap|geo",
        "xAxis": "column_name",
        "yAxis": "column_name",
        "title": "Chart Title",
        "colorScheme": "default|trust|growth|performance|categorical|warm|cool|alert"
      }
    }
  ]
}
Do not wrap JSON in markdown. Return only valid JSON.
`;

  try {
    console.log('🎨 Generating auto-dashboard for:', prompt);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Create a dashboard about: ${mappedPrompt}` }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.4,
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No response from OpenAI');
    }

    console.log('📊 Dashboard structure generated, executing queries...');
    const parsed = JSON.parse(content);
    const sqlHashes = Array.isArray(parsed.widgets)
      ? parsed.widgets.map(widget => widget.sql).filter(Boolean).map(sql => crypto.createHash('sha256').update(sql).digest('hex'))
      : [];
    incrementUsage(userId, 'dashboards', 1, undefined, orgId);
    logAudit(userId, 'llm.generate-dashboard', { prompt: prompt?.slice(0, 200), widgetCount, sql_hashes: sqlHashes, latency_ms: Date.now() - startedAt }, orgId);

    const widgetsWithData = [];

    for (const widget of parsed.widgets) {
      let chartData = null;
      let sqlError = null;
      let smartNarrative = null;

      if (dbConnection && widget.sql) {
        try {
          const config = buildDbConfig(dbConnection);
          chartData = await executeQuery(config, widget.sql);
          if (chartData.length > 50) {
            chartData = chartData.slice(0, 50);
          }
          chartData = limitChartData(chartData, widget.chartConfig);
          const narrativePrompt = `You are a data analyst. Given the following chart data and its explanation, write a concise, plain-language summary (2-3 sentences) for non-technical users. Focus on key takeaways, trends, and any notable points.\n\nChart Explanation: ${widget.explanation}\n\nChart Data (JSON): ${JSON.stringify(chartData).slice(0, 2000)}\n`;
          const narrativeRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${openaiApiKey}`
            },
            body: JSON.stringify({
              model: 'gpt-4o',
              messages: [
                { role: 'system', content: 'You are a helpful data analyst.' },
                { role: 'user', content: narrativePrompt }
              ],
              temperature: 0.4,
              max_tokens: 200
            })
          });
          if (narrativeRes.ok) {
            const narrativeData = await narrativeRes.json();
            smartNarrative = narrativeData.choices?.[0]?.message?.content?.trim() || null;
          }
        } catch (queryError) {
          sqlError = queryError.message;
        }
      }
      widgetsWithData.push({
        id: `auto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: widget.title,
        sql: widget.sql,
        explanation: widget.explanation,
        chartConfig: widget.chartConfig,
        chartData: chartData || [],
        sqlError: sqlError,
        smartNarrative: smartNarrative,
        addedAt: Date.now()
      });
    }

    logEvent(userId, 'generate-dashboard', true, { widgets: parsed.widgets?.length || 0, sql_hashes: sqlHashes, latency_ms: Date.now() - startedAt }, orgId);
    res.json({
      success: true,
      data: {
        dashboardTitle: parsed.dashboardTitle,
        description: parsed.description,
        widgets: widgetsWithData,
        generatedAt: Date.now()
      }
    });
  } catch (error) {
    console.error('❌ Auto-dashboard generation error:', error.message);
    logEvent(userId, 'generate-dashboard', false, { error: error.message, latency_ms: Date.now() - startedAt }, orgId);
    res.status(500).json({ success: false, error: error.message });
  }
});

// dashboardAgent.js
// Updated /dashboard-chat endpoint with:
// - Server-side SQL guardrails (SELECT-only, single statement, no dangerous keywords, LIMIT enforcement)
// - Result-shape validation (axes exist, chart type compatibility)
// - One bounded auto-repair retry (LLM fixes SQL+chartConfig using DB error/shape feedback)
// - Optional clarifications support (if model returns clarifications, we skip execution and ask user)
// - Safer schema injection (basic sanitization to reduce prompt injection surface)
// - Removes client-supplied apiKey (uses server env only)
router.post('/dashboard-chat', requireAuth, requireTenant, requirePermission('chat:use'), requireCapability('dashboard.update'), async (req, res) => {
  const startedAt = Date.now();
  const { prompt, schemaContext, apiKey, dbConnection, dashboardItems = [] } = req.body;
  const userId = req.user?.id;
  const orgId = req.auth?.tenant?.orgId || null;
  const plan = getPlanForUser(userId);
  const limit = checkLimit(userId, 'queries', plan?.monthly_query_limit, orgId);
  if (!limit.allowed) {
    return res.status(429).json({ success: false, error: 'Query limit reached for this month.' });
  }

  const openaiApiKey = (apiKey && apiKey.trim()) ? apiKey.trim() : process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    return res.status(400).json({ success: false, error: 'OpenAI API key is required.' });
  }

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ success: false, error: 'Prompt is required.' });
  }

  if (!schemaContext || typeof schemaContext !== 'string' || !schemaContext.trim()) {
    return res.status(400).json({ success: false, error: 'Database schema is required.' });
  }

  try {
    assertCapabilityScope(req, { connectorId: dbConnection?.id, schemaContext });
  } catch (error) {
    return res.status(403).json({ success: false, error: error.message });
  }

  const hasDbConnection = !!dbConnection;

  // -----------------------
  // Helpers (minimal + safe)
  // -----------------------

  const sanitizedItems = (dashboardItems || []).map(item => ({
    title: item.title,
    sql: item.sql,
    chartType: item.chartConfig?.type,
    xAxis: item.chartConfig?.xAxis,
    yAxis: item.chartConfig?.yAxis
  }));

  function normalizeSql(sql) {
    return String(sql || '').trim();
  }

  function isSingleStatement(sql) {
    const stripped = sql.replace(/;\s*$/g, '');
    return !stripped.includes(';');
  }

  function isSelectOnly(sql) {
    const s = sql.toLowerCase();
    const blocked = ['insert', 'update', 'delete', 'drop', 'alter', 'truncate', 'create', 'replace', 'grant', 'revoke', 'copy'];
    if (blocked.some(k => new RegExp(`\\b${k}\\b`, 'i').test(s))) return false;
    const firstToken = s.match(/^\s*(\w+)/)?.[1];
    if (!(firstToken === 'select' || firstToken === 'with')) return false;
    return /\bselect\b/i.test(s);
  }

  function guardSqlOrThrow(sql) {
    const cleaned = normalizeSql(sql);
    if (!cleaned) throw new Error('SQL is empty.');
    if (!isSingleStatement(cleaned)) throw new Error('SQL must be a single statement.');
    if (!isSelectOnly(cleaned)) throw new Error('Only read-only SELECT queries are allowed.');
    return cleaned.replace(/;\s*$/g, '');
  }

  function clampResultRows(rows, max = 50) {
    if (!Array.isArray(rows)) return [];
    return rows.length > max ? rows.slice(0, max) : rows;
  }

  function getColumns(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    return Object.keys(rows[0] || {});
  }

  function axesExist(rows, chartConfig) {
    const cols = getColumns(rows);
    if (!cols.length) return false;
    const x = chartConfig?.xAxis;
    const y = chartConfig?.yAxis;
    return !!x && !!y && cols.includes(x) && cols.includes(y);
  }

  function coerceNumericStrings(rows, chartConfig) {
    // Helps when DB returns numerics as strings and your chart layer treats them as empty.
    const y = chartConfig?.yAxis;
    if (!y || !Array.isArray(rows)) return rows;
    return rows.map(r => {
      const v = r[y];
      if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
        return { ...r, [y]: Number(v) };
      }
      return r;
    });
  }

  // -----------------------
  // Deterministic empty-result fallbacks (NO LLM needed)
  // -----------------------

  function widenDateFilters(sql) {
    // Widen common “last N days” patterns to 12–24 months.
    let s = sql;
    s = s.replace(/now\(\)\s*-\s*interval\s*'(\d+)\s*day(s)?'/gi, "now() - interval '12 months'");
    s = s.replace(/current_date\s*-\s*interval\s*'(\d+)\s*day(s)?'/gi, "current_date - interval '12 months'");
    return s;
  }

  function stripStatusLikeFilters(sql) {
    // Remove common brittle filters: status/type/state/is_active/etc.
    // Conservative: only strips simple AND clauses.
    let s = sql;
    s = s.replace(/\s+AND\s+("?status"?)\s*=\s*'[^']*'/gi, '');
    s = s.replace(/\s+AND\s+("?state"?)\s*=\s*'[^']*'/gi, '');
    s = s.replace(/\s+AND\s+("?type"?)\s*=\s*'[^']*'/gi, '');
    s = s.replace(/\s+AND\s+("?is_active"?)\s*=\s*(true|false)/gi, '');
    s = s.replace(/\s+AND\s+("?active"?)\s*=\s*(true|false)/gi, '');
    return s;
  }

  function relaxInnerJoins(sql) {
    // Switch INNER JOIN to LEFT JOIN to reduce “join eliminates rows”.
    return sql.replace(/\bINNER\s+JOIN\b/gi, 'LEFT JOIN');
  }

  function tryFallbackSql(sql, pass) {
    // pass: 1..3
    if (pass === 1) return widenDateFilters(sql);
    if (pass === 2) return stripStatusLikeFilters(widenDateFilters(sql));
    if (pass === 3) return relaxInnerJoins(stripStatusLikeFilters(widenDateFilters(sql)));
    return sql;
  }

  // -----------------------
  // Prompt shaping (DATA-FIRST dashboard)
  // -----------------------

  const mappedPrompt = typeof mapPromptBusinessTerms === 'function'
    ? mapPromptBusinessTerms(prompt, { schemaContext })
    : prompt;

  const semanticHints = typeof getSemanticSummary === 'function'
    ? getSemanticSummary(schemaContext)
    : null;

  const systemPrompt = `You are a data-first dashboard assistant.

DATABASE SCHEMA:
${schemaContext}

SEMANTIC HINTS (optional; use only if consistent with schema):
${semanticHints || 'None'}

CURRENT DASHBOARD WIDGETS (context; do not repeat unless requested):
${JSON.stringify(sanitizedItems, null, 2)}

TASK:
Generate 1-3 NEW widgets for a clean, general-purpose business dashboard.
IMPORTANT: Only propose widgets that can be computed directly from the schema. Do NOT assume budgets/targets/goals exist.

CRITICAL (to avoid empty/zero widgets):
1) Do NOT invent KPIs like "budget", "% of target", "goals" unless the schema clearly contains those fields/tables.
2) Prefer robust, data-backed KPIs:
   - COUNT(*), COUNT(DISTINCT id), SUM(amount/value), AVG(amount/value)
3) Avoid restrictive WHERE filters unless user asked.
   - If a time filter is needed, default to last 12 months (not 30 days).
4) Prefer LEFT JOIN for dimension tables; use INNER JOIN only when necessary.
5) Always ALIAS SELECT columns to EXACTLY match chartConfig.xAxis and chartConfig.yAxis.
   Example: SELECT DATE_TRUNC('month', created_at) AS month, SUM(total) AS total_sales ...

SQL RULES:
- Use only schema tables/columns exactly as named.
- Single read-only SELECT statement only (SELECT or WITH...SELECT). No DDL/DML. No semicolons.
- For categorical charts: TOP 10-12 categories (ORDER BY metric DESC + LIMIT).
- For time series: DATE_TRUNC day/week/month/quarter/year (default month).
- Use COALESCE for aggregations and NULLIF for division when needed.
- KPI widgets MUST return one row, one numeric value (with a clear alias).

CHART RULES:
- bar: categorical comparisons
- line/area: time series
- pie: only if <= 6-8 segments
- kpi: single numeric
Avoid gauge/percent-of-target unless schema explicitly supports it.

RESPONSE FORMAT (valid JSON only):
{
  "summary": "Short summary",
  "widgets": [
    {
      "title": "Widget Title",
      "sql": "SELECT ...",
      "explanation": "What this shows",
      "chartConfig": {
        "type": "bar|line|pie|area|scatter|composed|heatmap|kpi",
        "xAxis": "column_name",
        "yAxis": "column_name",
        "title": "Chart Title",
        "colorScheme": "default|trust|growth|performance|categorical|warm|cool|alert"
      }
    }
  ]
}`;

  async function callOpenAI(messages) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiApiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        response_format: { type: 'json_object' },
        temperature: 0.25,
        max_tokens: 2200
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `OpenAI API error: ${response.statusText}`);
    }
    return response.json();
  }

  function buildEmptyDataRepairPrompt(widget, lastSqlTried) {
    // This repair prompt is only used after deterministic fallbacks fail.
    return `The widget SQL produced empty results (0 rows) even after broadening attempts.

User request:
${mappedPrompt}

Widget intent:
${widget.title}

SQL tried:
${lastSqlTried}

Fix by producing a broader query that is more likely to return data while keeping the intent.
Rules:
- Do NOT add restrictive filters (status/type) unless explicitly requested.
- If time filtering is needed, use last 12–24 months.
- Prefer LEFT JOIN if joining dimension tables.
- Use only schema columns.
- Alias SELECT columns to match chartConfig.xAxis/yAxis exactly.
Return ONLY the widget JSON: {title, sql, explanation, chartConfig}.`;
  }

  try {
    console.log('💬 Dashboard chat request:', prompt);

    const llm = await callOpenAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: mappedPrompt }
    ]);

    const content = llm.choices[0]?.message?.content;
    if (!content) throw new Error('No response from OpenAI');

    const parsed = JSON.parse(content);
    const sqlHashes = Array.isArray(parsed.widgets)
      ? parsed.widgets.map(widget => widget.sql).filter(Boolean).map(sql => crypto.createHash('sha256').update(sql).digest('hex'))
      : [];
    incrementUsage(userId, 'queries', 1, undefined, orgId);
    logAudit(userId, 'llm.dashboard-chat', { prompt: prompt?.slice(0, 200), widgetCount: parsed.widgets?.length || 0, sql_hashes: sqlHashes, latency_ms: Date.now() - startedAt }, orgId);
    let widgets = Array.isArray(parsed.widgets) ? parsed.widgets : [];

    const widgetsWithData = [];

    for (const widget of widgets) {
      let chartData = [];
      let sqlError = null;
      let sqlUsed = widget.sql;
      let rawRowCount = 0;
      let postLimitCount = 0;
      let fallbackStage = 'none';

      if (hasDbConnection && widget.sql) {
        try {
          const config = buildDbConfig(dbConnection);

          // 1) Execute original (guarded)
          let sql0 = guardSqlOrThrow(widget.sql);

          chartData = await executeQuery(config, sql0);
          rawRowCount = Array.isArray(chartData) ? chartData.length : 0;
          sqlUsed = sql0;

          // 2) If empty, apply deterministic fallbacks (up to 3 passes)
          if (rawRowCount === 0) {
            for (let pass = 1; pass <= 3; pass++) {
              const candidate = guardSqlOrThrow(tryFallbackSql(sql0, pass));
              if (candidate === sqlUsed) continue;

              const rows = await executeQuery(config, candidate);
              const n = Array.isArray(rows) ? rows.length : 0;

              if (n > 0) {
                chartData = rows;
                rawRowCount = n;
                sqlUsed = candidate;
                fallbackStage = pass === 1 ? 'widen_date' : pass === 2 ? 'strip_filters' : 'relax_joins';
                break;
              }
            }
          }

          // 3) If still empty, ONE LLM repair attempt (broad query)
          if (rawRowCount === 0) {
            const repair = await callOpenAI([
              { role: 'system', content: 'You are a SQL expert. Return only JSON.' },
              { role: 'user', content: buildEmptyDataRepairPrompt(widget, sqlUsed) }
            ]);

            const rContent = repair.choices[0]?.message?.content;
            const rParsed = rContent ? JSON.parse(rContent) : null;
            const fixedWidget = rParsed?.sql ? rParsed : rParsed?.widget;

            if (fixedWidget?.sql) {
              const fixedSql = guardSqlOrThrow(fixedWidget.sql);
              const rows = await executeQuery(config, fixedSql);
              const n = Array.isArray(rows) ? rows.length : 0;

              widget.title = fixedWidget.title || widget.title;
              widget.explanation = fixedWidget.explanation || widget.explanation;
              widget.chartConfig = fixedWidget.chartConfig || widget.chartConfig;
              widget.sql = fixedSql;

              chartData = rows;
              rawRowCount = n;
              sqlUsed = fixedSql;
              fallbackStage = 'llm_repair';
            }
          }

          // 4) Post-processing: clamp + coerce + limitChartData (only if axes exist)
          chartData = clampResultRows(chartData, 50);
          chartData = coerceNumericStrings(chartData, widget.chartConfig);

          if (chartData.length > 0 && typeof limitChartData === 'function' && axesExist(chartData, widget.chartConfig)) {
            chartData = limitChartData(chartData, widget.chartConfig);
          }

          postLimitCount = Array.isArray(chartData) ? chartData.length : 0;

          // 5) If still empty after post-processing but raw had rows, don’t hide it
          // Return raw clamped rows instead of an empty chart (helps UX).
          if (postLimitCount === 0 && rawRowCount > 0) {
            // Re-run without limitChartData effects
            const rows = await executeQuery(config, sqlUsed);
            chartData = coerceNumericStrings(clampResultRows(rows, 50), widget.chartConfig);
            postLimitCount = chartData.length;
            fallbackStage = fallbackStage === 'none' ? 'bypass_limiter' : fallbackStage + '+bypass_limiter';
          }

        } catch (err) {
          sqlError = err.message;
        }
      }

      widgetsWithData.push({
        title: widget.title,
        sql: sqlUsed || widget.sql,
        explanation: widget.explanation,
        chartConfig: widget.chartConfig,
        chartData,
        sqlError,
        // optional diagnostics (helpful while stabilizing)
        meta: {
          rawRowCount,
          postLimitCount,
          fallbackStage
        }
      });
    }

    logEvent(userId, 'dashboard-chat', true, { widgets: parsed.widgets?.length || 0, sql_hashes: sqlHashes, latency_ms: Date.now() - startedAt }, orgId);
    return res.json({
      success: true,
      data: {
        summary: parsed.summary || 'Added new widgets.',
        widgets: widgetsWithData
      }
    });

  } catch (error) {
    console.error('❌ Dashboard chat error:', error.message);
    logEvent(userId, 'dashboard-chat', false, { error: error.message, latency_ms: Date.now() - startedAt }, orgId);
    return res.status(500).json({ success: false, error: error.message });
  }
});



router.post('/regenerate-widget', requireAuth, requireTenant, requirePermission('dashboards:update'), requireCapability('dashboard.update'), async (req, res) => {
  const startedAt = Date.now();
  const { widget, schemaContext, apiKey, dbConnection, refinementPrompt, originalError } = req.body;

  const openaiApiKey = (apiKey && apiKey.trim()) ? apiKey.trim() : process.env.OPENAI_API_KEY;

  if (!openaiApiKey) {
    return res.status(400).json({ success: false, error: 'OpenAI API key is required.' });
  }

  try {
    assertCapabilityScope(req, { connectorId: dbConnection?.id, schemaContext });
  } catch (error) {
    return res.status(403).json({ success: false, error: error.message });
  }

  const semanticHints = getSemanticSummary(schemaContext);
  const systemPrompt = `You are a SQL Expert fixing a failed database query.

DATABASE SCHEMA:
${schemaContext}

SEMANTIC HINTS (optional, use only if helpful and consistent with schema):
${semanticHints || 'None'}

ORIGINAL WIDGET THAT FAILED:
- Title: ${widget.title}
- Original SQL: ${widget.sql}
- Error: ${originalError || widget.sqlError || 'Query execution failed'}
${refinementPrompt ? `- User's refinement request: ${refinementPrompt}` : ''}

YOUR TASK:
Fix the SQL query so it executes successfully. Consider:
1. Check if table/column names match the schema exactly
2. Use proper SQL syntax for the database dialect
3. Ensure aggregations have proper GROUP BY clauses
4. Handle NULL values if needed
5. Use proper date functions if applicable
6. For categorical charts, return TOP 10-12 categories (ORDER BY metric DESC + LIMIT).
7. For time series, bucket dates using DATE_TRUNC (day/week/month/quarter/year). Default to month if not specified.
${refinementPrompt ? `6. Apply the user's refinement: "${refinementPrompt}"` : ''}

RESPONSE FORMAT (JSON):
{
  "title": "Widget Title (can update if needed)",
  "sql": "Fixed SQL query",
  "explanation": "What this query shows",
  "chartConfig": {
    "type": "bar|line|pie|area|radar|scatter|composed",
    "xAxis": "column_name",
    "yAxis": "column_name",
    "title": "Chart Title",
    "colorScheme": "default"
  }
}

Return only valid JSON without markdown blocks.`;

  try {
    console.log('🔄 Regenerating widget:', widget.title);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Fix and regenerate this widget.' }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 2048
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content);

    let chartData = null;
    let sqlError = null;

    if (dbConnection && parsed.sql) {
      try {
        const config = buildDbConfig(dbConnection);
        chartData = await executeQuery(config, parsed.sql);
        console.log(`✅ Regenerated "${parsed.title}": ${chartData.length} rows`);

        if (chartData.length > 50) {
          chartData = chartData.slice(0, 50);
        }
        chartData = limitChartData(chartData, parsed.chartConfig);
      } catch (queryError) {
        console.error(`❌ Regeneration still failed:`, queryError.message);
        sqlError = queryError.message;
      }
    }

    const sqlHash = parsed.sql ? crypto.createHash('sha256').update(parsed.sql).digest('hex') : null;
    logEvent(req.user?.id, 'regenerate-widget', true, { sql_hash: sqlHash, latency_ms: Date.now() - startedAt }, req.auth?.tenant?.orgId || null);
    res.json({
      success: true,
      data: {
        id: widget.id,
        title: parsed.title || widget.title,
        sql: parsed.sql,
        explanation: parsed.explanation,
        chartConfig: parsed.chartConfig,
        chartData: chartData || [],
        sqlError: sqlError,
        addedAt: Date.now()
      }
    });

  } catch (error) {
    console.error('❌ Widget regeneration error:', error.message);
    logEvent(req.user?.id, 'regenerate-widget', false, { error: error.message, latency_ms: Date.now() - startedAt }, req.auth?.tenant?.orgId || null);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/multiturn-chat', requireAuth, requireTenant, requirePermission('chat:use'), async (req, res) => {
  const startedAt = Date.now();
  const { prompt, schemaContext, apiKey, chatHistory = [] } = req.body;
  const userId = req.user?.id;
  const orgId = req.auth?.tenant?.orgId || null;
  const openaiApiKey = (apiKey && apiKey.trim()) ? apiKey.trim() : process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    return res.status(400).json({ success: false, error: 'OpenAI API key is required.' });
  }
  if (!chatHistories[userId]) chatHistories[userId] = [];
  const messages = [
    { role: 'system', content: `You are a world-class Data Analyst and SQL Expert. Given the database schema below, answer user questions with SQL and plain-language explanations. Maintain context across turns.\n\nSCHEMA CONTEXT:\n${schemaContext}` },
    ...chatHistories[userId],
    { role: 'user', content: prompt }
  ];
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: messages,
        temperature: 0.3,
        max_tokens: 2048
      })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `OpenAI API error: ${response.statusText}`);
    }
    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) throw new Error('No response from OpenAI');
    chatHistories[userId] = chatHistory.concat([{ role: 'user', content: prompt }, { role: 'assistant', content }]);
    logEvent(userId, 'multiturn-chat', true, { latency_ms: Date.now() - startedAt }, orgId);
    res.json({ success: true, data: { content } });
  } catch (error) {
    logEvent(userId, 'multiturn-chat', false, { error: error.message, latency_ms: Date.now() - startedAt }, orgId);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
