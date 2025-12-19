
import { Message } from "../types";

const OPENAI_API_KEY = "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";

const DB_SCHEMA = `
Table: orders (order_id, customer_id, order_date, total_amount, status)
Table: order_items (item_id, order_id, product_id, quantity, unit_price)
Table: products (product_id, product_name, category, price, stock_level)
Table: customers (customer_id, first_name, last_name, email, city, country)
`;

export async function generateOpenAiSqlQueryStream(
  prompt: string,
  onChunk: (text: string) => void
): Promise<Partial<Message>> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a world-class Data Analyst. Translate the user query into SQL based on this schema: ${DB_SCHEMA}. 
          Return ONLY a JSON object with: 
          - sql: valid SQL string
          - explanation: textual summary
          - chartConfig: { type: 'bar'|'line'|'pie'|'area', xAxis: string, yAxis: string, title: string }
          - chartData: Array of objects matching chartConfig.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      stream: true
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder("utf-8");
  let fullContent = "";

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");
      
      for (const line of lines) {
        if (line.startsWith("data: ") && line !== "data: [DONE]") {
          try {
            const data = JSON.parse(line.slice(6));
            const content = data.choices[0].delta.content || "";
            fullContent += content;
            onChunk("Thinking..."); // Signal progress
          } catch (e) {
            // ignore partial parse errors
          }
        }
      }
    }
  }

  const result = JSON.parse(fullContent);
  
  return {
    sql: result.sql,
    explanation: result.explanation,
    chartConfig: result.chartConfig,
    chartData: result.chartData,
    content: result.explanation
  };
}
