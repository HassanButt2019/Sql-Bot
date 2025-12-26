import { GoogleGenAI } from "@google/genai";
import { Message } from "../types";

// Standard initialization of Google GenAI as per current best practices
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function generateSqlQueryStream(
  prompt: string, 
  schemaContext: string,
  model: string = 'gemini-3-pro-preview',
  onChunk: (text: string) => void
): Promise<Partial<Message>> {
  // Use generateContentStream to provide progress feedback while the model reasons about financial data
  const responseStream = await ai.models.generateContentStream({
    model: model,
    contents: prompt,
    config: {
      systemInstruction: `You are a world-class Financial Data Analyst and Compliance Officer.
    Given the database schema below, provide a valid SQL query and an interactive analysis.
    
    SCHEMA CONTEXT:
    ${schemaContext}

    FINANCIAL INTELLIGENCE RULES:
    1. If the data contains time-series information, suggest a 'forecastData' series based on trends.
    2. Explicitly look for 'anomalies' (values that are > 2 std dev from mean or suspicious spikes).
    3. Choose 'colorScheme' based on risk: 'alert' for high-risk findings, 'trust' for audits, 'growth' for sales.
    4. PII MASKING: Never mention specific names or account IDs in the 'explanation'. Refer to them by category or trend.

    OUTPUT FORMAT (Raw JSON):
    - sql: The SQL query.
    - explanation: Narrative summary for executive stakeholders.
    - anomalies: Array of strings describing specific outlier points found.
    - chartConfig: { type, xAxis, yAxis, title, colorScheme }
    - chartData: Result set array.
    - forecastData: (Optional) Array for predicted future points.

    Return only the JSON string.`,
      responseMimeType: "application/json"
    }
  });

  let fullText = "";
  try {
    // Collect the full response text while notifying the UI of background progress
    for await (const chunk of responseStream) {
      fullText += chunk.text;
      onChunk("Running compliance checks..."); 
    }
  } catch (err) {
    console.error("Stream generation failed:", err);
    return { content: "Critical connection error during analysis." };
  }

  try {
    // Sanitize the response text to ensure clean JSON parsing
    const jsonStr = fullText.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    const data = JSON.parse(jsonStr || '{}');
    
    // Map extracted JSON fields to the Message interface, ensuring all financial analysis fields are handled correctly
    // Fixed: anomalies and forecastData are now known properties of Partial<Message>
    return {
      sql: data.sql,
      explanation: data.explanation,
      anomalies: Array.isArray(data.anomalies) ? data.anomalies : [],
      chartConfig: data.chartConfig,
      chartData: Array.isArray(data.chartData) ? data.chartData : [],
      forecastData: Array.isArray(data.forecastData) ? data.forecastData : [],
      content: data.explanation || "Analysis complete."
    };
  } catch (error) {
    console.error("Failed to parse analysis JSON:", error);
    return { content: "Error: Could not parse structured financial data." };
  }
}