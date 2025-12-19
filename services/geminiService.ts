import { GoogleGenAI, Type } from "@google/genai";
import { Message } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const DB_SCHEMA = `
Table: orders
Columns: order_id (int), customer_id (int), order_date (date), total_amount (decimal), status (string)

Table: order_items
Columns: item_id (int), order_id (int), product_id (int), quantity (int), unit_price (decimal)

Table: products
Columns: product_id (int), product_name (string), category (string), price (decimal), stock_level (int)

Table: customers
Columns: customer_id (int), first_name (string), last_name (string), email (string), city (string), country (string)
`;

export async function generateSqlQueryStream(
  prompt: string, 
  model: string = 'gemini-3-pro-preview',
  onChunk: (text: string) => void
): Promise<Partial<Message>> {
  const responseStream = await ai.models.generateContentStream({
    model: model,
    contents: prompt,
    config: {
      systemInstruction: `You are a world-class Data Analyst and Visualization Expert.
    Given the database schema provided below, translate the user's natural language question into a valid SQL query and a high-impact JSON visualization config.
    
    SCHEMA:
    ${DB_SCHEMA}

    VISUALIZATION RULES:
    1. Select the most effective chart type:
       - 'bar': For simple categorical comparisons.
       - 'line': For continuous time-series data.
       - 'area': For visualizing volume or totals over time.
       - 'pie': For part-to-whole relationships (limit to 6 segments).
       - 'radar': For comparing 3+ metrics across categories (e.g. comparing 5 products across 4 metrics).
       - 'scatter': For correlation between two numeric variables (X and Y must both be numbers).
       - 'composed': For comparing a value (bar) against a trend or target (line). Use 'yAxisSecondary' for the line metric.

    2. Choose a meaningful 'colorScheme':
       - 'performance': Use for KPIs (Revenue, Sales, Growth) where green/red semantics matter.
       - 'categorical': Use for distinct categories (Product Names, Regions).
       - 'warm': Use for urgent or heat-related data.
       - 'cool': Use for steady or technical data.
       - 'default': Standard clean aesthetic.

    Your response MUST be in valid JSON format with these keys:
    - sql: The generated SQL query.
    - explanation: A concise textual explanation of the data findings.
    - chartConfig: { type, xAxis, yAxis, yAxisSecondary?, title, colorScheme }
    - chartData: An array of 5-10 objects representing the mock result set.

    If the question cannot be answered by the schema, explain why.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          sql: { type: Type.STRING },
          explanation: { type: Type.STRING },
          chartConfig: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING },
              xAxis: { type: Type.STRING },
              yAxis: { type: Type.STRING },
              yAxisSecondary: { type: Type.STRING },
              title: { type: Type.STRING },
              colorScheme: { type: Type.STRING }
            },
            required: ['type', 'xAxis', 'yAxis', 'title']
          },
          chartData: {
            type: Type.ARRAY,
            items: { type: Type.OBJECT }
          }
        },
        required: ['sql', 'explanation', 'chartConfig', 'chartData']
      }
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
      content: data.explanation
    };
  } catch (error) {
    console.error("Failed to parse Gemini response", error);
    return { content: "I encountered an error processing that request." };
  }
}
