
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
Create a `.env` file in the root directory:
```env
API_KEY=your_gemini_api_key_here
```

### 4. Start the Application
```bash
npm run start
```

## 🔒 Security & Privacy
This application utilizes local database introspection. Database credentials and actual data records remain local to your environment; only schema metadata and natural language prompts are shared with the AI model to generate insights.

## 📄 License
MIT
