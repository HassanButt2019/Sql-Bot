const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const mysql = require('mysql2/promise');
const path = require('path');

// Load environment variables from parent directory's .env file
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- Shopify OAuth (in-memory; replace with persistent storage for production) ---
const shopifyTokens = new Map(); // shop -> access_token
const shopifyStates = new Map(); // shop -> state

function normalizeShopDomain(shop) {
  if (typeof shop !== 'string') return '';
  return shop.replace(/^https?:\/\//i, '').trim();
}

function isValidShopDomain(shop) {
  const normalized = normalizeShopDomain(shop);
  return normalized.endsWith('.myshopify.com');
}

function generateState() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Parse connection string to extract components (supports JDBC format)
function parseConnectionString(connectionString, dialect) {
  try {
    let urlToParse = connectionString.trim();
    
    // Handle JDBC format: jdbc:postgresql://host:port/database?params
    if (urlToParse.toLowerCase().startsWith('jdbc:')) {
      urlToParse = urlToParse.substring(5); // Remove 'jdbc:' prefix
    }
    
    const url = new URL(urlToParse);
    
    // Extract database name (remove query params if present)
    let database = url.pathname.slice(1);
    if (database.includes('?')) {
      database = database.split('?')[0];
    }
    
    // Check for SSL mode in query params
    const searchParams = new URLSearchParams(url.search);
    const sslMode = searchParams.get('sslmode') || searchParams.get('ssl');
    const requireSSL = sslMode === 'require' || sslMode === 'verify-ca' || sslMode === 'verify-full' || sslMode === 'true';
    
    return {
      host: url.hostname,
      port: url.port || (dialect === 'postgresql' ? '5432' : dialect === 'mysql' ? '3306' : '1433'),
      username: url.username ? decodeURIComponent(url.username) : null,
      password: url.password ? decodeURIComponent(url.password) : null,
      database: database,
      dialect,
      ssl: requireSSL
    };
  } catch (error) {
    // Try regex-based parsing for JDBC format
    const jdbcRegex = /^(?:jdbc:)?(\w+):\/\/([^:\/]+)(?::(\d+))?\/([^\?]+)(?:\?(.*))?$/i;
    const match = connectionString.match(jdbcRegex);
    
    if (match) {
      const [, protocol, host, port, database, queryString] = match;
      const params = new URLSearchParams(queryString || '');
      const sslMode = params.get('sslmode') || params.get('ssl');
      const requireSSL = sslMode === 'require' || sslMode === 'verify-ca' || sslMode === 'verify-full' || sslMode === 'true';
      
      return {
        host,
        port: port || (dialect === 'postgresql' ? '5432' : dialect === 'mysql' ? '3306' : '1433'),
        username: null,
        password: null,
        database,
        dialect,
        ssl: requireSSL
      };
    }
    
    throw new Error('Invalid connection string format. Expected format: jdbc:postgresql://host:port/database or postgresql://user:password@host:port/database');
  }
}

// PostgreSQL introspection
async function introspectPostgres(config) {
  // Validate required fields
  if (!config.username || !config.password) {
    throw new Error('Username and password are required. Please fill in the User and Password fields.');
  }
  
  console.log('Connecting to PostgreSQL:', { host: config.host, port: config.port, database: config.database, ssl: config.ssl, user: config.username });
  
  const poolConfig = {
    host: config.host,
    port: parseInt(config.port) || 5432,
    user: String(config.username), // Ensure it's a string
    password: String(config.password), // Ensure it's a string
    database: config.database,
    connectionTimeoutMillis: 30000, // 30 seconds timeout
    idle_in_transaction_session_timeout: 30000,
    statement_timeout: 30000,
  };
  
  // Enable SSL for Azure and other cloud providers
  // Azure PostgreSQL requires SSL
  if (config.ssl || config.host.includes('azure.com') || config.host.includes('amazonaws.com') || config.host.includes('cloud.google.com')) {
    poolConfig.ssl = { 
      rejectUnauthorized: false,
      // For Azure, we need to allow self-signed certificates
    };
    console.log('SSL enabled for connection');
  }
  
  const pool = new Pool(poolConfig);

  try {
    console.log('Attempting to connect...');
    const client = await pool.connect();
    console.log('Connected successfully to PostgreSQL!');
    
    // Get all tables with their columns
    const tablesQuery = `
      SELECT 
        t.table_name,
        array_agg(
          c.column_name || ' (' || c.data_type || 
          CASE WHEN c.is_nullable = 'NO' THEN ', NOT NULL' ELSE '' END ||
          CASE WHEN c.column_default IS NOT NULL THEN ', DEFAULT' ELSE '' END ||
          ')'
        ) as columns
      FROM information_schema.tables t
      JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
      WHERE t.table_schema = 'public' 
        AND t.table_type = 'BASE TABLE'
      GROUP BY t.table_name
      ORDER BY t.table_name;
    `;

    const result = await client.query(tablesQuery);
    client.release();
    await pool.end();
    
    console.log(`Found ${result.rows.length} tables`);
    console.log('--- FULL DATABASE SCHEMA ---');
    result.rows.forEach(row => {
      console.log(`Table: ${row.table_name}`);
      row.columns.forEach(col => console.log(`  ${col}`));
    });
    console.log('--- END OF SCHEMA ---');

    return result.rows.map(row => ({
      name: row.table_name,
      schema: row.columns.join(', '),
      selected: false
    }));
  } catch (error) {
    console.error('PostgreSQL connection error:', error.message);
    try { await pool.end(); } catch (e) {}
    throw error;
  }
}

// MySQL introspection
async function introspectMySQL(config) {
  const connection = await mysql.createConnection({
    host: config.host,
    port: parseInt(config.port) || 3306,
    user: config.username,
    password: config.password,
    database: config.database,
    connectTimeout: 10000,
  });

  try {
    const [tables] = await connection.execute(`
      SELECT 
        TABLE_NAME as table_name,
        GROUP_CONCAT(
          CONCAT(COLUMN_NAME, ' (', DATA_TYPE, 
          CASE WHEN IS_NULLABLE = 'NO' THEN ', NOT NULL' ELSE '' END,
          CASE WHEN COLUMN_DEFAULT IS NOT NULL THEN ', DEFAULT' ELSE '' END,
          ')')
          SEPARATOR ', '
        ) as columns
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ?
      GROUP BY TABLE_NAME
      ORDER BY TABLE_NAME
    `, [config.database]);

    await connection.end();

    return tables.map(row => ({
      name: row.table_name,
      schema: row.columns,
      selected: false
    }));
  } catch (error) {
    await connection.end();
    throw error;
  }
}

// Test connection endpoint
app.post('/api/test-connection', async (req, res) => {
  const { host, port, username, password, database, dialect, connectionString, useConnectionString } = req.body;

  let config = { host, port, username, password, database, dialect };
  
  if (useConnectionString && connectionString) {
    try {
      config = { ...parseConnectionString(connectionString, dialect), password };
    } catch (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  try {
    if (dialect === 'postgresql') {
      const pool = new Pool({
        host: config.host,
        port: parseInt(config.port) || 5432,
        user: config.username,
        password: config.password,
        database: config.database,
        connectionTimeoutMillis: 10000,
      });
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      await pool.end();
    } else if (dialect === 'mysql') {
      const connection = await mysql.createConnection({
        host: config.host,
        port: parseInt(config.port) || 3306,
        user: config.username,
        password: config.password,
        database: config.database,
        connectTimeout: 10000,
      });
      await connection.execute('SELECT 1');
      await connection.end();
    } else {
      return res.status(400).json({ success: false, error: `Dialect ${dialect} is not yet supported` });
    }

    res.json({ success: true, message: 'Connection successful!' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Introspect database endpoint
app.post('/api/introspect', async (req, res) => {
  const { host, port, username, password, database, dialect, connectionString, useConnectionString } = req.body;
  
  console.log('Introspect request received:', { useConnectionString, dialect, host, database });

  let config = { host, port, username, password, database, dialect, ssl: false };
  
  if (useConnectionString && connectionString) {
    try {
      const parsed = parseConnectionString(connectionString, dialect);
      // Merge: use parsed values but override username/password from form if provided
      config = {
        ...parsed,
        username: username || parsed.username,
        password: password || parsed.password,
      };
      console.log('Parsed connection string:', { host: config.host, port: config.port, database: config.database, ssl: config.ssl });
    } catch (error) {
      console.error('Connection string parse error:', error.message);
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  try {
    let tables = [];

    if (dialect === 'postgresql') {
      tables = await introspectPostgres(config);
    } else if (dialect === 'mysql') {
      tables = await introspectMySQL(config);
    } else {
      return res.status(400).json({ success: false, error: `Dialect ${dialect} is not yet supported` });
    }

    // Auto-select first 3 tables if available
    tables = tables.map((t, index) => ({ ...t, selected: index < 3 }));

    res.json({ success: true, tables, config: { host: config.host, database: config.database, dialect } });
  } catch (error) {
    console.error('Introspection error:', error.message);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Execute SQL query endpoint (for future use)
app.post('/api/execute-query', async (req, res) => {
  const { host, port, username, password, database, dialect, query, connectionString, useConnectionString } = req.body;

  let config = { host, port, username, password, database, dialect };
  
  if (useConnectionString && connectionString) {
    try {
      config = { ...parseConnectionString(connectionString, dialect), password };
    } catch (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  try {
    let result = [];

    if (dialect === 'postgresql') {
      const pool = new Pool({
        host: config.host,
        port: parseInt(config.port) || 5432,
        user: config.username,
        password: config.password,
        database: config.database,
        connectionTimeoutMillis: 10000,
      });
      const client = await pool.connect();
      const queryResult = await client.query(query);
      result = queryResult.rows;
      client.release();
      await pool.end();
    } else if (dialect === 'mysql') {
      const connection = await mysql.createConnection({
        host: config.host,
        port: parseInt(config.port) || 3306,
        user: config.username,
        password: config.password,
        database: config.database,
        connectTimeout: 10000,
      });
      const [rows] = await connection.execute(query);
      result = rows;
      await connection.end();
    }

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Execute SQL query helper function
async function executeQuery(config, query) {
  if (config.dialect === 'postgresql') {
    const poolConfig = {
      host: config.host,
      port: parseInt(config.port) || 5432,
      user: config.username,
      password: config.password,
      database: config.database,
      connectionTimeoutMillis: 30000,
    };
    
    if (config.ssl || config.host.includes('azure.com') || config.host.includes('amazonaws.com')) {
      poolConfig.ssl = { rejectUnauthorized: false };
    }
    
    const pool = new Pool(poolConfig);
    const client = await pool.connect();
    const queryResult = await client.query(query);
    client.release();
    await pool.end();
    return queryResult.rows;
  } else if (config.dialect === 'mysql') {
    const connection = await mysql.createConnection({
      host: config.host,
      port: parseInt(config.port) || 3306,
      user: config.username,
      password: config.password,
      database: config.database,
      connectTimeout: 30000,
    });
    const [rows] = await connection.execute(query);
    await connection.end();
    return rows;
  }
  throw new Error(`Unsupported dialect: ${config.dialect}`);
}

// Limit chart data for readability when the SQL returns too many points
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

// --- Self-Healing Query Middleware ---
async function selfHealingQuery(config, sql, maxRetries = 2) {
  let attempt = 0;
  let lastError = null;
  let result = [];
  let adjustedSql = sql;

  while (attempt <= maxRetries) {
    try {
      result = await executeQuery(config, adjustedSql);
      // Check for NaN or null in numeric results
      if (result && result.length > 0) {
        const hasNaN = result.some(row => Object.values(row).some(v => typeof v === 'number' && (isNaN(v) || v === null)));
        if (!hasNaN) return result;
      }
      // If NaN/null found, adjust SQL
      lastError = 'NaN or null detected';
    } catch (err) {
      lastError = err.message;
    }
    // Adjust SQL: add COALESCE and NULLIF for numeric columns
    adjustedSql = adjustedSql.replace(/(SUM|AVG|COUNT|MIN|MAX)\(([^)]+)\)/gi, '$1(COALESCE($2,0))')
                             .replace(/\/(\s*\w+)/g, '/NULLIF($1,0)');
    attempt++;
  }
  throw new Error(`Self-healing failed: ${lastError}`);
}

// --- Helper: Map business terms in prompt to schema columns using semantic layer ---
function mapPromptBusinessTerms(prompt) {
  // For each table and business term, replace in prompt
  let mappedPrompt = prompt;
  for (const [table, mapping] of Object.entries(semanticLayer)) {
    for (const [businessTerm, column] of Object.entries(mapping)) {
      // Replace business term with column name (case-insensitive, word boundary)
      const regex = new RegExp(`\\b${businessTerm}\\b`, 'gi');
      mappedPrompt = mappedPrompt.replace(regex, column);
    }
  }
  return mappedPrompt;
}

// OpenAI Chat Completion endpoint (proxied to avoid CORS issues)
app.post('/api/chat', async (req, res) => {
  const { prompt, schemaContext, apiKey, dbConnection } = req.body;
  
  // Use provided API key only if it's a non-empty string, otherwise fall back to env variable
  const openaiApiKey = (apiKey && apiKey.trim()) ? apiKey.trim() : process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    return res.status(400).json({ success: false, error: 'OpenAI API key is required. Please add it in Settings or set OPENAI_API_KEY in .env file.' });
  }

  // Map business terms in prompt before sending to LLM
  const mappedPrompt = mapPromptBusinessTerms(prompt);

  const systemPrompt = `You are a world-class Data Analyst and SQL Expert.
Given the database schema provided below, translate the user's natural language question into a valid SQL query and visualization config.

SCHEMA CONTEXT:
${schemaContext}

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
        temperature: 0.3, // Lower temperature for more consistent SQL
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
    
    // If we have database connection info, execute the SQL to get real data
    let chartData = null;
    let sqlError = null;
    
    if (dbConnection && parsed.sql) {
      try {
        console.log('Executing SQL:', parsed.sql);
        
        const config = {
          host: dbConnection.host,
          port: dbConnection.port || '5432',
          username: dbConnection.username,
          password: dbConnection.password,
          database: dbConnection.database,
          dialect: dbConnection.dialect || 'postgresql',
          ssl: dbConnection.ssl || dbConnection.host.includes('azure.com')
        };
        
        chartData = await executeQuery(config, parsed.sql);
        console.log(`Query returned ${chartData.length} rows`);
        
        // Limit to 100 rows for visualization
        if (chartData.length > 100) {
          chartData = chartData.slice(0, 100);
        }

        chartData = limitChartData(chartData, parsed.chartConfig);
      } catch (queryError) {
        console.error('SQL execution error:', queryError.message);
        sqlError = queryError.message;
        // Don't fail completely - return the generated SQL even if execution fails
      }
    }

    res.json({ 
      success: true, 
      data: {
        content: parsed.explanation || 'Analysis complete.',
        sql: parsed.sql,
        explanation: parsed.explanation,
        chartConfig: parsed.chartConfig,
        chartData: chartData, // Real data from database!
        sqlError: sqlError
      }
    });
  } catch (error) {
    console.error('OpenAI API error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Shopify OAuth: start
app.get('/api/integrations/shopify/authorize', (req, res) => {
  const { shop } = req.query;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const redirectUri = process.env.SHOPIFY_REDIRECT_URI || 'https://dev2-8561.myshopify.com/admin/oauth/authorize';
  const scopes = (process.env.SHOPIFY_SCOPES || 'read_all_orders,read_customers,read_price_rules,write_price_rules,read_discounts,write_discounts')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .join(',');

  if (!clientId) {
    return res.status(400).json({ success: false, error: 'SHOPIFY_CLIENT_ID is required.' });
  }
  const normalizedShop = normalizeShopDomain(shop);
  if (!isValidShopDomain(normalizedShop)) {
    return res.status(400).json({ success: false, error: 'Invalid shop domain. Use *.myshopify.com' });
  }

  const state = generateState();
  shopifyStates.set(normalizedShop, state);

  const authUrl = `https://${normalizedShop}/admin/oauth/authorize?client_id=${clientId}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
  res.json({ success: true, url: authUrl });
});

// Shopify OAuth: callback
app.get('/api/integrations/shopify/callback', async (req, res) => {
  const { shop, code, state } = req.query;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  const appRedirect = process.env.APP_BASE_URL || 'http://localhost:3000';

  if (!clientId || !clientSecret) {
    return res.status(400).send('Missing Shopify credentials.');
  }
  const normalizedShop = normalizeShopDomain(shop);
  if (!isValidShopDomain(normalizedShop)) {
    return res.status(400).send('Invalid shop domain.');
  }
  const expectedState = shopifyStates.get(normalizedShop);
  if (!expectedState || expectedState !== state) {
    return res.status(400).send('Invalid OAuth state.');
  }

  try {
    const tokenRes = await fetch(`https://${normalizedShop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code
      })
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      throw new Error(errorText || 'Failed to exchange Shopify token.');
    }

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      throw new Error('No access_token in response.');
    }

    shopifyTokens.set(normalizedShop, tokenData.access_token);
    shopifyStates.delete(normalizedShop);

    res.redirect(`${appRedirect}/?shopify=connected&shop=${encodeURIComponent(normalizedShop)}`);
  } catch (error) {
    res.status(500).send(error.message || 'Shopify OAuth failed.');
  }
});

// Shopify OAuth: status
app.get('/api/integrations/shopify/status', (req, res) => {
  const { shop } = req.query;
  const normalizedShop = normalizeShopDomain(shop);
  if (!isValidShopDomain(normalizedShop)) {
    return res.status(400).json({ success: false, error: 'Invalid shop domain.' });
  }
  const connected = shopifyTokens.has(normalizedShop);
  res.json({ success: true, connected });
});

// Report scheduling endpoint (stores schedule for future email integration)
app.post('/api/reports/schedule', async (req, res) => {
  const { dashboardId, dashboardTitle, frequency, time, email, format } = req.body;
  
  // Validate required fields
  if (!dashboardId || !email || !frequency) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing required fields: dashboardId, email, and frequency are required' 
    });
  }
  
  // In a production environment, you would:
  // 1. Store the schedule in a database
  // 2. Set up a cron job or use a service like Bull/Agenda for Node.js
  // 3. Connect to an email service (SendGrid, AWS SES, etc.)
  
  const schedule = {
    id: Date.now().toString(),
    dashboardId,
    dashboardTitle,
    frequency,
    time: time || '09:00',
    email,
    format: format || 'pdf',
    enabled: true,
    createdAt: Date.now(),
    nextRun: calculateNextRun(frequency, time)
  };
  
  console.log('📅 Report schedule created:', schedule);
  
  res.json({ 
    success: true, 
    schedule,
    message: 'Schedule created. Note: Email delivery requires additional backend setup (SendGrid, AWS SES, etc.)'
  });
});

// Helper to calculate next run time
function calculateNextRun(frequency, time) {
  const now = new Date();
  const [hours, minutes] = (time || '09:00').split(':').map(Number);
  
  let nextRun = new Date();
  nextRun.setHours(hours, minutes, 0, 0);
  
  if (nextRun <= now) {
    switch (frequency) {
      case 'daily':
        nextRun.setDate(nextRun.getDate() + 1);
        break;
      case 'weekly':
        nextRun.setDate(nextRun.getDate() + 7);
        break;
      case 'monthly':
        nextRun.setMonth(nextRun.getMonth() + 1);
        break;
    }
  }
  
  return nextRun.toISOString();
}

// AUTO-DASHBOARD GENERATION ENDPOINT
// Generates multiple dashboard widgets from a single prompt
app.post('/api/generate-dashboard', async (req, res) => {
  const { prompt, schemaContext, apiKey, dbConnection, widgetCount = 8 } = req.body; // Removed filters
  
  // Use provided API key only if it's a non-empty string, otherwise fall back to env variable
  const openaiApiKey = (apiKey && apiKey.trim()) ? apiKey.trim() : process.env.OPENAI_API_KEY;
  
  console.log('🔑 Using API key:', openaiApiKey ? `${openaiApiKey.substring(0, 10)}...` : 'NOT SET');
  
  if (!openaiApiKey) {
    return res.status(400).json({ success: false, error: 'OpenAI API key is required. Set it in the app settings or in the .env file.' });
  }

  // Ensure schemaContext is always a valid, non-empty string
  if (!schemaContext || typeof schemaContext !== 'string' || !schemaContext.trim()) {
    return res.status(400).json({ success: false, error: 'Database schema is required. Please connect to a database first.' });
  }

  // Map business terms in prompt before sending to LLM
  const mappedPrompt = mapPromptBusinessTerms(prompt);

  // Add actionable business suggestion instructions for feature importance and correlation analysis
  const systemPrompt = `You are a world-class Data Analyst and Dashboard Designer.

DATABASE SCHEMA:
${schemaContext}

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
    
    // Execute each widget's SQL to get real data
    const widgetsWithData = [];
    
    for (const widget of parsed.widgets) {
      let chartData = null;
      let sqlError = null;
      let smartNarrative = null;
      
      if (dbConnection && widget.sql) {
        try {
          const config = {
            host: dbConnection.host,
            port: dbConnection.port || '5432',
            username: dbConnection.username,
            password: dbConnection.password,
            database: dbConnection.database,
            dialect: dbConnection.dialect || 'postgresql',
            ssl: dbConnection.ssl || dbConnection.host.includes('azure.com')
          };
          chartData = await executeQuery(config, widget.sql);
          // Limit rows for visualization
          if (chartData.length > 50) {
            chartData = chartData.slice(0, 50);
          }
          chartData = limitChartData(chartData, widget.chartConfig);
          // --- Smart Narrative Generation ---
          // Use OpenAI to generate a plain-language summary for this chart
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
        smartNarrative: smartNarrative, // <-- Attach smart narrative
        addedAt: Date.now()
      });
    }

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
    res.status(500).json({ success: false, error: error.message });
  }
});

// DASHBOARD CHAT ENDPOINT
// Adds new widgets to an existing dashboard based on user prompt
app.post('/api/dashboard-chat', async (req, res) => {
  const { prompt, schemaContext, apiKey, dbConnection, dashboardItems = [] } = req.body;

  const openaiApiKey = (apiKey && apiKey.trim()) ? apiKey.trim() : process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    return res.status(400).json({ success: false, error: 'OpenAI API key is required.' });
  }

  if (!schemaContext || typeof schemaContext !== 'string' || !schemaContext.trim()) {
    return res.status(400).json({ success: false, error: 'Database schema is required.' });
  }

  const hasDbConnection = !!dbConnection;

  const sanitizedItems = (dashboardItems || []).map(item => ({
    title: item.title,
    sql: item.sql,
    chartType: item.chartConfig?.type,
    xAxis: item.chartConfig?.xAxis,
    yAxis: item.chartConfig?.yAxis
  }));

  const systemPrompt = `You are a finance operations dashboard assistant.

DATABASE SCHEMA:
${schemaContext}

CURRENT DASHBOARD WIDGETS (for context; do not repeat unless requested):
${JSON.stringify(sanitizedItems, null, 2)}

TASK:
Given the user's request, generate 1-3 NEW widgets to add to this dashboard.

RULES:
- Use only tables/columns from the schema above.
- Do not duplicate existing widgets.
- Limit each query to 10-50 rows for chart readability.
- Prefer finance-ops metrics (cash flow, AP/AR aging, budget vs actuals, vendor spend, cost centers, margin).
- Use COALESCE for numeric aggregations and NULLIF for division.
- For categorical charts, return TOP 10-12 categories (ORDER BY metric DESC + LIMIT).
- For time series, bucket dates using DATE_TRUNC (day/week/month/quarter/year). Default to month if not specified.
- Return only JSON with the exact structure below.

RESPONSE FORMAT (JSON):
{
  "summary": "Short summary of what you added",
  "widgets": [
    {
      "title": "Widget Title",
      "sql": "SELECT ...",
      "explanation": "What this widget shows",
      "chartConfig": {
        "type": "bar|line|pie|area|radar|scatter|composed|gauge|heatmap|geo|kpi",
        "xAxis": "column_name",
        "yAxis": "column_name",
        "title": "Chart Title",
        "colorScheme": "default|trust|growth|performance|categorical|warm|cool|alert"
      }
    }
  ]
}`;

  try {
    console.log('💬 Dashboard chat request:', prompt);

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
          { role: 'user', content: prompt }
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
    if (!content) throw new Error('No response from OpenAI');

    const parsed = JSON.parse(content);
    const widgets = Array.isArray(parsed.widgets) ? parsed.widgets : [];

    const widgetsWithData = [];

    for (const widget of widgets) {
      let chartData = [];
      let sqlError = null;

      if (hasDbConnection && widget.sql) {
        try {
          const config = {
            host: dbConnection.host,
            port: dbConnection.port || '5432',
            username: dbConnection.username,
            password: dbConnection.password,
            database: dbConnection.database,
            dialect: dbConnection.dialect || 'postgresql',
            ssl: dbConnection.ssl || dbConnection.host.includes('azure.com')
          };

          chartData = await executeQuery(config, widget.sql);
          if (chartData.length > 50) chartData = chartData.slice(0, 50);
          chartData = limitChartData(chartData, widget.chartConfig);
        } catch (queryError) {
          sqlError = queryError.message;
        }
      }

      widgetsWithData.push({
        title: widget.title,
        sql: widget.sql,
        explanation: widget.explanation,
        chartConfig: widget.chartConfig,
        chartData,
        sqlError
      });
    }

    res.json({
      success: true,
      data: {
        summary: parsed.summary || 'Added new widgets.',
        widgets: widgetsWithData
      }
    });
  } catch (error) {
    console.error('❌ Dashboard chat error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all scheduled reports
app.get('/api/reports/schedules', (req, res) => {
  // In production, fetch from database
  res.json({ 
    success: true, 
    schedules: [],
    message: 'Schedules are currently stored in browser localStorage. Backend storage coming soon.'
  });
});

// Send report now (manual trigger)
app.post('/api/reports/send', async (req, res) => {
  const { dashboardId, email, format } = req.body;
  
  // In production, this would:
  // 1. Generate the report (PDF/CSV)
  // 2. Send via email service
  
  console.log('📧 Manual report send requested:', { dashboardId, email, format });
  
  res.json({ 
    success: true, 
    message: 'Report send initiated. Email delivery requires backend email service integration.'
  });
});

// REGENERATE SINGLE WIDGET ENDPOINT
// Regenerates a failed widget with optional refinement prompt
app.post('/api/regenerate-widget', async (req, res) => {
  const { widget, schemaContext, apiKey, dbConnection, refinementPrompt, originalError } = req.body;
  
  const openaiApiKey = (apiKey && apiKey.trim()) ? apiKey.trim() : process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    return res.status(400).json({ success: false, error: 'OpenAI API key is required.' });
  }

  const systemPrompt = `You are a SQL Expert fixing a failed database query.

DATABASE SCHEMA:
${schemaContext}

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
          { role: 'user', content: `Fix this widget: "${widget.title}"${refinementPrompt ? ` with refinement: ${refinementPrompt}` : ''}` }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 1024
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
    
    // Execute the fixed SQL
    let chartData = null;
    let sqlError = null;
    
    if (dbConnection && parsed.sql) {
      try {
        const config = {
          host: dbConnection.host,
          port: dbConnection.port || '5432',
          username: dbConnection.username,
          password: dbConnection.password,
          database: dbConnection.database,
          dialect: dbConnection.dialect || 'postgresql',
          ssl: dbConnection.ssl || dbConnection.host.includes('azure.com')
        };
        
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
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- Semantic Layer Mapping ---
const semanticLayer = {
  budgets: {
    "Target Value": "budget_value",
    "Product ID": "product_id",
    "Actual Sales to Date": "product_actual_sale",
    "Budget Date": "date"
  },
  companies: {
    "Company Name": "name"
  },
  external_indicators: {
    "Country": "country_name",
    "Indicator Detail": "indicator_full_name",
    "Indicator Name": "indicator_name",
    "Reporting Date": "date",
    "Index Value": "value"
  },
  forecast_sales_budgets: {
    "Forecast Date": "date",
    "Predicted Sales": "forecasted_sales",
    "Allocated Budget": "forecasted_budget",
    "Product ID": "product_id"
  },
  forecasts: {
    "Forecast Value": "forecast_value",
    "Product ID": "product_id",
    "Forecast Date": "date"
  },
  internal_sales_data: {
    "Cleaned Value": "transformed_value",
    "Sales Date": "date",
    "Product ID": "product_id",
    "Company ID": "company_id",
    "Raw Revenue": "sales_value"
  },
  lagged_features: {
    "Product ID": "product_id",
    "Observation Date": "date",
    "Feature Name": "feature_name",
    "Feature Value": "feature_value"
  },
  product_feature_importances: {
    "Calculation Date": "calculation_date",
    "Product ID": "product_id",
    "Feature": "feature_name",
    "Pearson Correlation": "pearson_score",
    "Spearman Correlation": "spearman_score"
  },
  product_predictions: {
    "Prediction Date": "date",
    "Realized Sales": "product_actual_sale",
    "Product ID": "product_id",
    "AI Predicted Sales": "predicted_sales"
  },
  products: {
    "Product Name": "name",
    "Company ID": "company_id"
  },
  seasonality_autoregs: {
    "Forecast Output": "forecast_value",
    "Fiscal Quarter": "quarter",
    "Product ID": "product_id",
    "Calculated On": "calculation_date",
    "Average Seasonal Component": "seasonal_component_avg"
  },
  trained_models: {
    "Root Mean Square Error": "rmse",
    "Mean Absolute Percentage Error": "mape",
    "Mean Absolute Error": "mae",
    "Product ID": "product_id",
    "Model Name": "model_name",
    "Training Timestamp": "train_date",
    "Model Config": "hyperparameters_json"
  }
};

function mapBusinessLogic(table, businessTerm) {
  return semanticLayer[table]?.[businessTerm] || businessTerm;
}

// --- Multi-Turn Chat Endpoint ---
// Maintains chat history for context-aware follow-up questions
const chatHistories = {};

app.post('/api/multiturn-chat', async (req, res) => {
  const { userId, prompt, schemaContext, apiKey, dbConnection, chatHistory = [] } = req.body;
  const openaiApiKey = (apiKey && apiKey.trim()) ? apiKey.trim() : process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    return res.status(400).json({ success: false, error: 'OpenAI API key is required.' });
  }
  // Maintain chat history per user
  if (!chatHistories[userId]) chatHistories[userId] = [];
  // Add previous turns
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
        messages,
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
    if (!content) throw new Error('No response from OpenAI');
    const parsed = JSON.parse(content);
    // Save this turn to history
    chatHistories[userId].push({ role: 'user', content: prompt });
    chatHistories[userId].push({ role: 'assistant', content: content });
    // Optionally trim history for memory
    if (chatHistories[userId].length > 20) chatHistories[userId] = chatHistories[userId].slice(-20);
    // Optionally execute SQL and attach chartData as in /api/chat
    let chartData = null;
    let sqlError = null;
    if (dbConnection && parsed.sql) {
      try {
        const config = {
          host: dbConnection.host,
          port: dbConnection.port || '5432',
          username: dbConnection.username,
          password: dbConnection.password,
          database: dbConnection.database,
          dialect: dbConnection.dialect || 'postgresql',
          ssl: dbConnection.ssl || dbConnection.host.includes('azure.com')
        };
        chartData = await executeQuery(config, parsed.sql);
        if (chartData.length > 100) chartData = chartData.slice(0, 100);
        chartData = limitChartData(chartData, parsed.chartConfig);
      } catch (queryError) {
        sqlError = queryError.message;
      }
    }
    res.json({
      success: true,
      data: {
        ...parsed,
        chartData,
        sqlError,
        chatHistory: chatHistories[userId]
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Daily sync stub for Shopify (replace with real job + storage)
setInterval(() => {
  if (shopifyTokens.size === 0) return;
  console.log('🕒 Shopify daily sync stub:', Array.from(shopifyTokens.keys()));
}, 1000 * 60 * 60 * 24);
