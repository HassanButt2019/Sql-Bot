const express = require('express');
const {
  getOrCreateProfile,
  upsertCustomMappings,
  confirmMappings,
  applyAgentProposals
} = require('../llm/semanticLayer.cjs');
const { executeQuery } = require('../db/index.cjs');
const { requireAuth, requireTenant } = require('../middleware/auth.cjs');
const { requirePermission } = require('../policies/rbac.cjs');

const router = express.Router();

router.post('/semantic/profile', requireAuth, requireTenant, requirePermission('connectors:read'), (req, res) => {
  const { schemaContext, sourceId } = req.body;
  if (!schemaContext || typeof schemaContext !== 'string' || !schemaContext.trim()) {
    return res.status(400).json({ success: false, error: 'schemaContext is required.' });
  }
  const profile = getOrCreateProfile(schemaContext, sourceId);
  res.json({ success: true, data: profile });
});

router.post('/semantic/custom-mappings', requireAuth, requireTenant, requirePermission('connectors:read'), (req, res) => {
  const { schemaContext, table, mappings, sourceId } = req.body;
  if (!schemaContext || !table || !mappings) {
    return res.status(400).json({ success: false, error: 'schemaContext, table, and mappings are required.' });
  }
  const profile = upsertCustomMappings(schemaContext, table, mappings, sourceId);
  res.json({ success: true, data: profile });
});

router.post('/semantic/confirm-mappings', requireAuth, requireTenant, requirePermission('connectors:read'), (req, res) => {
  const { schemaContext, confirmations, sourceId } = req.body;
  if (!schemaContext || !Array.isArray(confirmations)) {
    return res.status(400).json({ success: false, error: 'schemaContext and confirmations array are required.' });
  }
  const profile = confirmMappings(schemaContext, confirmations, sourceId);
  res.json({ success: true, data: profile });
});

router.post('/semantic/agent', requireAuth, requireTenant, requirePermission('connectors:read'), async (req, res) => {
  const { schemaContext, apiKey, sourceId, sourceType = 'unknown', profileData, dbConnection } = req.body;
  const openaiApiKey = (apiKey && apiKey.trim()) ? apiKey.trim() : process.env.OPENAI_API_KEY;

  if (!schemaContext || typeof schemaContext !== 'string' || !schemaContext.trim()) {
    return res.status(400).json({ success: false, error: 'schemaContext is required.' });
  }

  if (!openaiApiKey) {
    return res.status(400).json({ success: false, error: 'OpenAI API key is required.' });
  }

  let resolvedProfileData = profileData;

  if (!resolvedProfileData && dbConnection) {
    const parseTables = (schema) => {
      if (!schema || typeof schema !== 'string') return [];
      const blocks = schema.split(/\n\s*\n/);
      const tables = [];
      for (const block of blocks) {
        const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
        const tableLine = lines.find(line => line.startsWith('TABLE:'));
        if (!tableLine) continue;
        const name = tableLine.replace('TABLE:', '').trim();
        if (name) tables.push({ name });
      }
      return tables;
    };

    const quoteChar = dbConnection.dialect === 'mysql' ? '`' : '"';
    const tableProfiles = [];
    const tables = parseTables(schemaContext).slice(0, 4);
    for (const table of tables) {
      const quoted = `${quoteChar}${table.name}${quoteChar}`;
      let rows = [];
      try {
        rows = await executeQuery(dbConnection, `SELECT * FROM ${quoted} LIMIT 5`);
      } catch {
        try {
          rows = await executeQuery(dbConnection, `SELECT * FROM ${table.name} LIMIT 5`);
        } catch {
          rows = [];
        }
      }
      const columnStats = {};
      for (const row of rows || []) {
        for (const [key, value] of Object.entries(row || {})) {
          if (!columnStats[key]) {
            columnStats[key] = { nonNull: 0, distinct: new Set(), examples: [] };
          }
          if (value !== null && value !== undefined && value !== '') {
            columnStats[key].nonNull += 1;
            const serialized = typeof value === 'string' ? value : JSON.stringify(value);
            if (!columnStats[key].distinct.has(serialized) && columnStats[key].examples.length < 3) {
              columnStats[key].examples.push(value);
            }
            columnStats[key].distinct.add(serialized);
          }
        }
      }
      const normalizedStats = {};
      for (const [key, stat] of Object.entries(columnStats)) {
        normalizedStats[key] = {
          nonNull: stat.nonNull,
          distinct: stat.distinct.size,
          examples: stat.examples
        };
      }
      tableProfiles.push({
        name: table.name,
        sampleRows: rows || [],
        columnStats: normalizedStats
      });
    }
    resolvedProfileData = { tables: tableProfiles };
  }

  const sourceHint = sourceType === 'excel'
    ? 'Excel source: columns may be typed as text; dates/numbers can be strings; rely on sample values for semantics.'
    : sourceType === 'sql'
      ? 'SQL source: prefer schema types and id relationships; avoid guessing beyond clear keys.'
      : 'Unknown source: be conservative and only propose high-confidence mappings.';

  const systemPrompt = `You are a semantic-layer specialist. Given a database schema and optional profile data, propose a practical semantic layer.

SCHEMA CONTEXT:
${schemaContext}

SOURCE TYPE:
${sourceType}

SOURCE HINT:
${sourceHint}

PROFILE DATA (sample rows + stats, may be partial):
${resolvedProfileData ? JSON.stringify(resolvedProfileData).slice(0, 4000) : 'None'}

RULES:
- Only use tables/columns from the schema provided.
- Use profile data to ground mappings when available; be conservative otherwise.
- Prefer safe, minimal, high-confidence mappings.
- Provide join hints only when obvious (shared id/name keys).
- Output valid JSON only, no markdown.

RESPONSE FORMAT (JSON):
{
  "mappings": [
    { "table": "table_name", "term": "business_term", "column": "column_name", "confidence": 0.0-1.0 }
  ],
  "metrics": [
    { "name": "metric_name", "description": "what it means", "formula": "SQL-like formula", "tables": ["table_a"] }
  ],
  "joins": [
    { "leftTable": "table_a", "leftColumn": "col", "rightTable": "table_b", "rightColumn": "col", "reason": "shared key" }
  ],
  "displayNames": [
    { "table": "table_name", "column": "column_name", "label": "Human Friendly Label" }
  ]
}`;

  try {
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
          { role: 'user', content: 'Generate semantic proposals for this schema.' }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
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
    const profile = applyAgentProposals(schemaContext, parsed, sourceId);

    res.json({
      success: true,
      data: {
        proposals: parsed,
        profile
      }
    });
  } catch (error) {
    console.error('Semantic agent error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
