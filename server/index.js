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

// OpenAI Chat Completion endpoint (proxied to avoid CORS issues)
app.post('/api/chat', async (req, res) => {
  const { prompt, schemaContext, apiKey, dbConnection } = req.body;
  
  // Use provided API key only if it's a non-empty string, otherwise fall back to env variable
  const openaiApiKey = (apiKey && apiKey.trim()) ? apiKey.trim() : process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    return res.status(400).json({ success: false, error: 'OpenAI API key is required. Please add it in Settings or set OPENAI_API_KEY in .env file.' });
  }

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
          { role: 'user', content: prompt }
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
  const { prompt, schemaContext, apiKey, dbConnection, widgetCount = 4 } = req.body;
  
  // Use provided API key only if it's a non-empty string, otherwise fall back to env variable
  const openaiApiKey = (apiKey && apiKey.trim()) ? apiKey.trim() : process.env.OPENAI_API_KEY;
  
  console.log('🔑 Using API key:', openaiApiKey ? `${openaiApiKey.substring(0, 10)}...` : 'NOT SET');
  
  if (!openaiApiKey) {
    return res.status(400).json({ success: false, error: 'OpenAI API key is required. Set it in the app settings or in the .env file.' });
  }

  if (!schemaContext) {
    return res.status(400).json({ success: false, error: 'Database schema is required. Please connect to a database first.' });
  }

  const systemPrompt = `You are a world-class Data Analyst and Dashboard Designer.
Given the database schema below, create ${widgetCount} diverse dashboard widgets based on the user's request.

DATABASE SCHEMA:
${schemaContext}

TASK: Generate ${widgetCount} different analytics widgets that form a cohesive dashboard about: "${prompt}"

Each widget should:
1. Answer a different aspect of the user's request
2. Use an appropriate chart type for the data
3. Have a clear, descriptive title
4. Use valid SQL for the given schema

CHART TYPE GUIDELINES:
- 'bar': Categorical comparisons, rankings, top-N lists
- 'line': Time-series, trends over periods
- 'area': Volume/totals over time, cumulative data
- 'pie': Part-to-whole relationships (max 6-8 segments)
- 'radar': Multi-dimensional comparisons
- 'scatter': Correlations between two numeric variables
- 'composed': Combining bar + line for different metrics

COLOR SCHEME OPTIONS:
- 'trust': Professional blues/grays
- 'growth': Success/growth greens
- 'performance': Multi-color for KPIs
- 'categorical': Vibrant distinct colors
- 'warm': Orange/red tones
- 'cool': Blue/purple tones
- 'alert': Warning reds
- 'default': Clean balanced palette

RESPONSE FORMAT (JSON):
{
  "dashboardTitle": "Descriptive Dashboard Title",
  "description": "Brief description of what this dashboard shows",
  "widgets": [
    {
      "title": "Widget Title",
      "sql": "SELECT column1, COUNT(*) as count FROM table GROUP BY column1 LIMIT 10",
      "explanation": "What this widget shows",
      "chartConfig": {
        "type": "bar",
        "xAxis": "column1",
        "yAxis": "count",
        "title": "Widget Title",
        "colorScheme": "categorical"
      }
    }
  ]
}

RULES:
1. Generate EXACTLY ${widgetCount} widgets
2. Each SQL must be valid and executable
3. Include diverse chart types (don't repeat the same type for all)
4. Make widgets complementary - together they tell a complete story
5. Use aggregations (COUNT, SUM, AVG) for chart-friendly data
6. Limit results to 10-20 rows per widget
7. Consider including: totals, trends, rankings, distributions, comparisons

Do not wrap JSON in markdown. Return only valid JSON.`;

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
          { role: 'user', content: `Create a dashboard about: ${prompt}` }
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
          console.log(`✅ Widget "${widget.title}": ${chartData.length} rows`);
          
          // Limit rows for visualization
          if (chartData.length > 50) {
            chartData = chartData.slice(0, 50);
          }
        } catch (queryError) {
          console.error(`❌ Widget "${widget.title}" error:`, queryError.message);
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

app.listen(PORT, () => {
  console.log(`🚀 Database API server running on http://localhost:${PORT}`);
  console.log(`📊 Supported dialects: PostgreSQL, MySQL`);
  console.log(`🤖 OpenAI GPT-4o endpoint available at /api/chat`);
  console.log(`📋 Report scheduling endpoints available at /api/reports/*`);
  console.log(`🔑 OpenAI API Key: ${process.env.OPENAI_API_KEY ? 'Loaded from .env (' + process.env.OPENAI_API_KEY.substring(0, 10) + '...)' : 'NOT SET - add OPENAI_API_KEY to .env'}`);
});
