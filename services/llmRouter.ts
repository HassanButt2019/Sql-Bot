import { LLMModel, Message } from "../types";
import { generateSqlQueryStream as generateGeminiQuery } from "./geminiService";

export async function queryModel(
  prompt: string, 
  schema: string,
  model: LLMModel,
  onChunk: (text: string) => void
): Promise<Partial<Message>> {
  // Use Gemini exclusively for all "model selections" to avoid browser CORS/Fetch issues 
  // with providers like OpenAI/Anthropic when calling from the frontend.
  switch (model) {
    case 'gpt-4o':
      return await generateGeminiQuery(prompt, schema, 'gemini-3-pro-preview', onChunk);
    case 'gemini-3-pro':
      return await generateGeminiQuery(prompt, schema, 'gemini-3-pro-preview', onChunk);
    case 'gemini-3-flash':
      return await generateGeminiQuery(prompt, schema, 'gemini-3-flash-preview', onChunk);
    case 'claude-3-5':
      // Map Claude requests to Gemini 3 Pro for similar reasoning capabilities
      const result = await generateGeminiQuery(prompt, schema, 'gemini-3-pro-preview', onChunk);
      return {
        ...result,
        content: result.content
      };
    default:
      return await generateGeminiQuery(prompt, schema, 'gemini-3-flash-preview', onChunk);
  }
}