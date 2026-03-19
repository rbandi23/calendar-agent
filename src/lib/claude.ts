import OpenAI from "openai";

let _client: OpenAI | null = null;

/**
 * Returns a singleton OpenAI client.
 * Reads OPENAI_API_KEY from the environment.
 */
export function getOpenAIClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}
