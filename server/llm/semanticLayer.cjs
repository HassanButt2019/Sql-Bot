const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SEMANTIC_STORE_PATH = path.join(__dirname, 'semanticProfiles.json');

const legacySemanticLayer = {
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

const BASE_CONCEPTS = {
  id: ['id', 'identifier', 'key'],
  date: ['date', 'day'],
  datetime: ['datetime', 'timestamp', 'time', 'created', 'updated'],
  name: ['name', 'title', 'label'],
  description: ['description', 'details', 'notes'],
  amount: ['amount', 'total', 'value', 'price', 'cost', 'revenue', 'sales', 'balance', 'budget'],
  quantity: ['quantity', 'qty', 'count', 'volume'],
  category: ['category', 'type', 'segment', 'group'],
  status: ['status', 'state'],
  region: ['region', 'area', 'territory'],
  country: ['country', 'nation'],
  city: ['city', 'town'],
  user: ['user', 'customer', 'client', 'account'],
  product: ['product', 'item', 'sku'],
  company: ['company', 'vendor', 'supplier', 'brand']
};

const DEFAULT_STORE = {
  version: 1,
  profiles: [],
  sharedConcepts: {},
  auditLog: []
};

const AUTO_APPLY_CONFIDENCE = 0.85;

function loadStore() {
  try {
    if (!fs.existsSync(SEMANTIC_STORE_PATH)) return { ...DEFAULT_STORE };
    const raw = fs.readFileSync(SEMANTIC_STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STORE, ...parsed };
  } catch (error) {
    return { ...DEFAULT_STORE };
  }
}

function saveStore(store) {
  try {
    fs.writeFileSync(SEMANTIC_STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
  } catch (error) {
    // Non-fatal: keep in-memory behavior if disk is unavailable.
  }
}

function hashSchema(schemaContext) {
  return crypto.createHash('sha1').update(schemaContext || '').digest('hex');
}

function normalizeIdentifier(value) {
  return String(value || '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function buildColumnAliases(columnName) {
  const normalized = normalizeIdentifier(columnName);
  const words = normalized.split(' ').filter(Boolean);
  const aliases = new Set();
  aliases.add(columnName);
  aliases.add(normalized);
  aliases.add(words.join(' '));
  aliases.add(words.join('_'));
  aliases.add(words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
  return Array.from(aliases).filter(Boolean);
}

function inferConcepts(columnName, columnType) {
  const normalized = normalizeIdentifier(columnName);
  const matches = new Set();
  for (const [concept, aliases] of Object.entries(BASE_CONCEPTS)) {
    for (const alias of aliases) {
      if (normalized.includes(alias)) {
        matches.add(concept);
      }
    }
  }
  if (columnType) {
    const type = columnType.toLowerCase();
    if (type.includes('date') || type.includes('time')) {
      matches.add(type.includes('time') ? 'datetime' : 'date');
    }
    if (type.includes('int') || type.includes('decimal') || type.includes('numeric') || type.includes('float')) {
      matches.add('amount');
    }
  }
  return Array.from(matches);
}

function parseSchemaContext(schemaContext) {
  if (!schemaContext || typeof schemaContext !== 'string') return [];
  const tables = [];
  const blocks = schemaContext.split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
    const tableLine = lines.find(line => line.startsWith('TABLE:'));
    const columnsLine = lines.find(line => line.startsWith('COLUMNS:'));
    if (!tableLine || !columnsLine) continue;
    const tableName = tableLine.replace('TABLE:', '').trim();
    const columnsRaw = columnsLine.replace('COLUMNS:', '').trim();
    const columnsList = [];
    let current = '';
    let depth = 0;
    for (let i = 0; i < columnsRaw.length; i++) {
      const char = columnsRaw[i];
      if (char === '(') depth += 1;
      if (char === ')') depth = Math.max(0, depth - 1);
      if (char === ',' && depth === 0) {
        if (current.trim()) columnsList.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    }
    if (current.trim()) columnsList.push(current.trim());

    const columns = columnsList.map(col => {
      const match = col.match(/^(.+?)\s*\((.+)\)$/);
      if (match) {
        return { name: match[1].trim(), type: match[2].trim() };
      }
      return { name: col, type: '' };
    });
    tables.push({ name: tableName, columns });
  }
  return tables;
}

function buildProfile(schemaContext, sourceId) {
  const tables = parseSchemaContext(schemaContext);
  const profile = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sourceId: sourceId || 'unknown',
    schemaHash: hashSchema(schemaContext),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tables: {},
    concepts: {},
    proposedMappings: [],
    confirmedMappings: [],
    customMappings: {},
    version: 1
  };

  for (const table of tables) {
    const tableEntry = { columns: {}, concepts: {} };
    for (const column of table.columns) {
      const aliases = buildColumnAliases(column.name);
      const concepts = inferConcepts(column.name, column.type);
      tableEntry.columns[column.name] = {
        name: column.name,
        type: column.type,
        aliases,
        concepts,
        confidence: concepts.length > 0 ? 0.6 : 0.3
      };
      for (const concept of concepts) {
        if (!tableEntry.concepts[concept]) tableEntry.concepts[concept] = [];
        tableEntry.concepts[concept].push(column.name);
      }
    }
    profile.tables[table.name] = tableEntry;
  }

  profile.proposedMappings = proposeMappings(profile);
  return profile;
}

function proposeMappings(profile) {
  const proposals = [];
  for (const [tableName, table] of Object.entries(profile.tables)) {
    for (const [concept, columns] of Object.entries(table.concepts)) {
      if (columns.length === 1) {
        proposals.push({
          table: tableName,
          concept,
          column: columns[0],
          confidence: 0.65,
          status: 'proposed'
        });
      }
    }
  }
  return proposals;
}

function mergeAgentProposals(profile, agentMappings) {
  const confirmed = new Set(
    (profile.confirmedMappings || []).map(m => `${m.table}|${m.concept}|${m.column}`)
  );
  const existing = new Set(
    (profile.proposedMappings || []).map(m => `${m.table}|${m.concept}|${m.column}`)
  );
  const next = [...(profile.proposedMappings || [])];

  for (const mapping of agentMappings || []) {
    const table = mapping.table || mapping.tableName;
    const concept = mapping.concept || mapping.term || mapping.businessTerm;
    const column = mapping.column;
    if (!table || !concept || !column) continue;
    const key = `${table}|${concept}|${column}`;
    if (confirmed.has(key) || existing.has(key)) continue;
    next.push({
      table,
      concept,
      column,
      confidence: typeof mapping.confidence === 'number' ? mapping.confidence : 0.7,
      status: 'proposed',
      source: 'agent'
    });
    existing.add(key);
  }
  return next;
}

function getOrCreateProfile(schemaContext, sourceId) {
  const store = loadStore();
  const schemaHash = hashSchema(schemaContext);
  let profile = store.profiles.find(p => p.schemaHash === schemaHash);
  if (!profile) {
    profile = buildProfile(schemaContext, sourceId);
    store.profiles.push(profile);
    store.auditLog.push({ action: 'create_profile', schemaHash, sourceId: sourceId || 'unknown', at: Date.now() });
    saveStore(store);
  }
  return profile;
}

function saveProfile(profile, action, meta = {}) {
  const store = loadStore();
  const idx = store.profiles.findIndex(p => p.schemaHash === profile.schemaHash);
  if (idx >= 0) {
    store.profiles[idx] = profile;
  } else {
    store.profiles.push(profile);
  }
  store.auditLog.push({ action, at: Date.now(), schemaHash: profile.schemaHash, ...meta });
  saveStore(store);
}

function buildSemanticHints(profile) {
  if (!profile) return '';
  const hints = [];
  for (const [table, mappings] of Object.entries(profile.customMappings || {})) {
    for (const [term, column] of Object.entries(mappings || {})) {
      hints.push(`${table}.${term} -> ${column} (custom)`);
    }
  }
  for (const mapping of profile.proposedMappings || []) {
    if (mapping.status !== 'proposed') continue;
    hints.push(`${mapping.table}.${mapping.concept} -> ${mapping.column}`);
  }
  for (const mapping of profile.confirmedMappings || []) {
    hints.push(`${mapping.table}.${mapping.concept} -> ${mapping.column} (confirmed)`);
  }
  return hints.slice(0, 40).join('; ');
}

function buildAliasMap(profile) {
  const aliasMap = new Map();
  for (const [table, mappings] of Object.entries(profile.customMappings || {})) {
    for (const [term, column] of Object.entries(mappings || {})) {
      if (!term) continue;
      const key = term.toLowerCase();
      const existing = aliasMap.get(key) || [];
      existing.push({ column, confidence: 0.9, alias: term, table });
      aliasMap.set(key, existing);
    }
  }
  for (const table of Object.values(profile.tables)) {
    for (const column of Object.values(table.columns)) {
      const aliases = column.aliases || [];
      for (const alias of aliases) {
        if (!alias) continue;
        const key = alias.toLowerCase();
        const existing = aliasMap.get(key) || [];
        existing.push({ column: column.name, confidence: column.confidence || 0.4, alias });
        aliasMap.set(key, existing);
      }
    }
  }
  return aliasMap;
}

function applyAliasMap(prompt, aliasMap) {
  let mappedPrompt = prompt;
  for (const candidates of aliasMap.values()) {
    const best = candidates.sort((a, b) => b.confidence - a.confidence);
    if (best.length === 0) continue;
    if (best.length > 1 && best[0].confidence === best[1].confidence) continue;
    const replacement = best[0].column;
    const escaped = best[0].alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    mappedPrompt = mappedPrompt.replace(regex, replacement);
  }
  return mappedPrompt;
}

function mapPromptBusinessTerms(prompt, options = {}) {
  let mappedPrompt = prompt;
  const schemaContext = options.schemaContext || '';
  if (schemaContext) {
    const profile = getOrCreateProfile(schemaContext, options.sourceId);
    const aliasMap = buildAliasMap(profile);
    mappedPrompt = applyAliasMap(mappedPrompt, aliasMap);
  }
  for (const mapping of Object.values(legacySemanticLayer)) {
    for (const [businessTerm, column] of Object.entries(mapping)) {
      const regex = new RegExp(`\\b${businessTerm}\\b`, 'gi');
      mappedPrompt = mappedPrompt.replace(regex, column);
    }
  }
  return mappedPrompt;
}

function mapBusinessLogic(table, businessTerm, options = {}) {
  const schemaContext = options.schemaContext || '';
  if (schemaContext) {
    const profile = getOrCreateProfile(schemaContext, options.sourceId);
    const custom = profile.customMappings?.[table];
    if (custom && custom[businessTerm]) return custom[businessTerm];
    const tableProfile = profile.tables[table];
    if (tableProfile) {
      for (const column of Object.values(tableProfile.columns)) {
        if ((column.aliases || []).includes(businessTerm)) {
          return column.name;
        }
      }
    }
  }
  return legacySemanticLayer[table]?.[businessTerm] || businessTerm;
}

function getSemanticSummary(schemaContext, sourceId) {
  if (!schemaContext) return '';
  const profile = getOrCreateProfile(schemaContext, sourceId);
  return buildSemanticHints(profile);
}

function applyAgentProposals(schemaContext, proposals, sourceId) {
  if (!schemaContext || !proposals) return null;
  const profile = getOrCreateProfile(schemaContext, sourceId);
  profile.agentProposals = {
    generatedAt: Date.now(),
    ...proposals
  };
  if (Array.isArray(proposals.mappings)) {
    const pending = [];
    const autoApplied = [];
    for (const mapping of proposals.mappings) {
      const term = mapping.term || mapping.concept || mapping.businessTerm;
      const table = mapping.table || mapping.tableName;
      const column = mapping.column;
      const confidence = typeof mapping.confidence === 'number' ? mapping.confidence : 0.7;
      if (!term || !table || !column) continue;

      if (confidence >= AUTO_APPLY_CONFIDENCE) {
        autoApplied.push({ table, term });
        if (!profile.customMappings) profile.customMappings = {};
        if (!profile.customMappings[table]) profile.customMappings[table] = {};
        if (!profile.customMappings[table][term]) {
          profile.customMappings[table][term] = column;
        }
        profile.confirmedMappings = profile.confirmedMappings || [];
        const key = `${table}|${term}|${column}`;
        if (!profile.confirmedMappings.some(m => `${m.table}|${m.concept}|${m.column}` === key)) {
          profile.confirmedMappings.push({
            table,
            concept: term,
            column,
            confidence,
            status: 'confirmed',
            confirmedAt: Date.now(),
            source: 'agent'
          });
        }
      } else {
        pending.push({ table, term, column, confidence });
      }
    }
    if (autoApplied.length > 0 && Array.isArray(profile.proposedMappings)) {
      profile.proposedMappings = profile.proposedMappings.filter(mapping => {
        return !autoApplied.some(item => item.table === mapping.table && item.term === mapping.concept);
      });
    }
    profile.proposedMappings = mergeAgentProposals(
      profile,
      pending.map(item => ({
        table: item.table,
        term: item.term,
        column: item.column,
        confidence: item.confidence
      }))
    );
  }
  profile.updatedAt = Date.now();
  saveProfile(profile, 'agent_proposals', { sourceId: sourceId || 'unknown' });
  return profile;
}

function upsertCustomMappings(schemaContext, table, mappings, sourceId) {
  if (!schemaContext || !table || !mappings) return null;
  const profile = getOrCreateProfile(schemaContext, sourceId);
  if (!profile.customMappings) profile.customMappings = {};
  if (!profile.customMappings[table]) profile.customMappings[table] = {};
  for (const [term, column] of Object.entries(mappings)) {
    if (!term || !column) continue;
    profile.customMappings[table][term] = column;
    if (Array.isArray(profile.proposedMappings)) {
      profile.proposedMappings = profile.proposedMappings.filter(mapping => {
        if (mapping.table !== table) return true;
        return mapping.concept !== term;
      });
    }
    profile.confirmedMappings = profile.confirmedMappings || [];
    const key = `${table}|${term}|${column}`;
    if (!profile.confirmedMappings.some(mapping => `${mapping.table}|${mapping.concept}|${mapping.column}` === key)) {
      profile.confirmedMappings.push({
        table,
        concept: term,
        column,
        confidence: 1,
        status: 'confirmed',
        confirmedAt: Date.now(),
        source: 'user'
      });
    }
  }
  profile.updatedAt = Date.now();
  saveProfile(profile, 'custom_mappings', { table, sourceId: sourceId || 'unknown' });
  return profile;
}

function confirmMappings(schemaContext, confirmations, sourceId) {
  if (!schemaContext || !Array.isArray(confirmations)) return null;
  const profile = getOrCreateProfile(schemaContext, sourceId);
  for (const mapping of confirmations) {
    if (!mapping || !mapping.table || !mapping.column) continue;
    profile.confirmedMappings = profile.confirmedMappings || [];
    profile.confirmedMappings.push({ ...mapping, status: 'confirmed', confirmedAt: Date.now() });
  }
  profile.updatedAt = Date.now();
  saveProfile(profile, 'confirm_mappings', { count: confirmations.length, sourceId: sourceId || 'unknown' });
  return profile;
}

module.exports = {
  semanticLayer: legacySemanticLayer,
  mapPromptBusinessTerms,
  mapBusinessLogic,
  getSemanticSummary,
  getOrCreateProfile,
  upsertCustomMappings,
  confirmMappings,
  applyAgentProposals
};
