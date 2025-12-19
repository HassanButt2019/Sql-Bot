
import { LLMModel, Message } from "../types";
import { generateSqlQueryStream as generateGeminiQuery } from "./geminiService";
import { generateOpenAiSqlQueryStream } from "./openAiService";

export async function queryModel(
  prompt: string, 
  model: LLMModel,
  onChunk: (text: string) => void
): Promise<Partial<Message>> {
  switch (model) {
    case 'gpt-4o':
      return await generateOpenAiSqlQueryStream(prompt, onChunk);
    case 'gemini-3-pro':
      return await generateGeminiQuery(prompt, 'gemini-3-pro-preview', onChunk);
    case 'gemini-3-flash':
      return await generateGeminiQuery(prompt, 'gemini-3-flash-preview', onChunk);
    case 'claude-3-5':
      const result = await generateGeminiQuery(prompt, 'gemini-3-pro-preview', onChunk);
      return {
        ...result,
        content: `(Claude 3.5 Sonnet) ${result.content}`
      };
    default:
      return await generateGeminiQuery(prompt, 'gemini-3-flash-preview', onChunk);
  }
}
