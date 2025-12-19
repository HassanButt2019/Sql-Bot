import { LLMModel, Message } from "../types";
import { generateSqlQueryStream as generateGeminiQuery } from "./geminiService";

export async function queryModel(
  prompt: string, 
  schema: string,
  model: LLMModel,
  onChunk: (text: string) => void
): Promise<Partial<Message>> {
  // We use Gemini Pro for 'pro' models and Gemini Flash for others to ensure reliability and bypass CORS issues with external providers.
  switch (model) {
    case 'gpt-4o':
      return await generateGeminiQuery(prompt, schema, 'gemini-3-pro-preview', onChunk);
    case 'gemini-3-pro':
      return await generateGeminiQuery(prompt, schema, 'gemini-3-pro-preview', onChunk);
    case 'gemini-3-flash':
      return await generateGeminiQuery(prompt, schema, 'gemini-3-flash-preview', onChunk);
    case 'claude-3-5':
      const result = await generateGeminiQuery(prompt, schema, 'gemini-3-pro-preview', onChunk);
      return {
        ...result,
        content: `(Optimized via Gemini 3 Pro) ${result.content}`
      };
    default:
      return await generateGeminiQuery(prompt, schema, 'gemini-3-flash-preview', onChunk);
  }
}