
# SQLMind - AI Financial BI Suite

SQLMind is a professional-grade Business Intelligence platform that leverages Generative AI (Google Gemini) to transform natural language queries into executable SQL, interactive data visualizations, and high-stakes financial reports.

## 🚀 Key Features

- **Multi-Model Intelligence**: Seamlessly switch between Gemini 3 Pro, Flash, and other flagship models.
- **Financial Compliance Mode**: Built-in PII masking, anomaly detection, and audit trails for banking-grade security.
- **Interactive Dashboards**: Persistent, resizable charts with real-time alerting and multi-format exports (PDF/CSV).
- **Dynamic Database Introspection**: Connect and analyze complex schemas (PostgreSQL, MySQL, SQLite) without sending data to the cloud.
- **Smart Visualizations**: Automated chart selection including Bar, Line, Area, Pie, Radar, and Composed charts with customizable color palettes.

## 🛠️ Setup Instructions

### 1. Prerequisites
- Node.js (v18 or higher)
- A Google Gemini API Key

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/sqlmind-bi-suite.git

# Navigate to the project
cd sqlmind-bi-suite

# Install dependencies
npm install
```

### 3. Environment Configuration
Use separate env files per environment and keep real secrets in `.env.*.local` (never committed).

Recommended structure:
```
.env.example
.env.development
.env.development.local
.env.production
.env.production.local
```

Copy the template:
```bash
cp .env.example .env.development
```

### 4. Start the Application
```bash
npm run start
```

## 🔒 Security & Privacy
This application utilizes local database introspection. Database credentials and actual data records remain local to your environment; only schema metadata and natural language prompts are shared with the AI model to generate insights.

## 📄 License
MIT




Missing (launch‑critical, Day‑0)

User accounts + profiles (no auth/login/user store)
Payments / plans / subscription handling (no Stripe or billing)
Usage limits / quotas per user/plan
Audit logs of queries/actions
Basic analytics (usage, failures)
Admin controls for plan limits
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_AUTH=20
RATE_LIMIT_MAX_GENERAL=120
LLM_RATE_LIMIT_WINDOW_MS=60000
LLM_RATE_LIMIT_MAX=30
JSON_BODY_LIMIT=1mb
