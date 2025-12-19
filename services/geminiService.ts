import { GoogleGenAI } from "@google/genai";
import { Message } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export async function generateSqlQueryStream(
  prompt: string, 
  schemaContext: string,
  model: string = 'gemini-3-pro-preview',
  onChunk: (text: string) => void
): Promise<Partial<Message>> {
  const responseStream = await ai.models.generateContentStream({
    model: model,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      systemInstruction: `You are a world-class Data Analyst and Visualization Expert.
    Given the database schema provided below, translate the user's natural language question into a valid SQL query and a high-impact JSON visualization config.
    
    SCHEMA CONTEXT:
    ${schemaContext}

    VISUALIZATION RULES:
    1. Select the most effective chart type:
       - 'bar': For simple categorical comparisons.
       - 'line': For continuous time-series data.
       - 'area': For visualizing volume or totals over time.
       - 'pie': For part-to-whole relationships (limit to 6 segments).
       - 'radar': For comparing 3+ metrics across categories.
       - 'scatter': For correlation between two numeric variables.
       - 'composed': For comparing a value (bar) against a trend or target (line).

    2. Choose a meaningful 'colorScheme' based on the context of the data:
       - 'trust': Professional blues/grays (Corporate reporting, security, stable metrics).
       - 'growth': Greens (Revenue increase, sales growth, positive trends).
       - 'performance': Green/Yellow/Red (KPI tracking, performance metrics).
       - 'categorical': Diverse high-contrast colors (Regional breakdown, product types).
       - 'warm': Reds/Oranges (Urgent alerts, heatmaps, high activity).
       - 'cool': Cyans/Indigos (Technical data, baseline metrics).
       - 'alert': High-saturation Reds (Risk detection, stock shortages, critical errors).
       - 'default': Clean standard aesthetic.

    Your response MUST be in valid JSON format with these keys:
    - sql: The generated SQL query string.
    - explanation: A concise textual explanation of the data findings.
    - chartConfig: { type, xAxis, yAxis, yAxisSecondary?, title, colorScheme }
    - chartData: An array of objects representing the result set (keys match xAxis/yAxis).

    If the question cannot be answered by the schema, explain why.`,
      responseMimeType: "application/json"
    }
  });

  let fullText = "";
  for await (const chunk of responseStream) {
    const text = chunk.text;
    fullText += text;
    onChunk("Synthesizing insights..."); 
  }

  try {
    const data = JSON.parse(fullText || '{}');
    return {
      sql: data.sql,
      explanation: data.explanation,
      chartConfig: data.chartConfig,
      chartData: data.chartData,
      content: data.explanation || "Analysis complete."
    };
  } catch (error) {
    console.error("Failed to parse Gemini response", error);
    return { content: "I encountered an error processing the structured data response." };
  }
}