import type { AIInsight } from './aiInsights'
import { SYSTEM_PROMPT, buildUserMessage, insightSchema, parseInsightsArray } from './shared'
import type { LLMAnalysisInput } from './shared'

export interface OpenAICompatibleOptions {
  endpoint?: string
  model?: string
}

export async function analyzeWithOpenAICompatible(
  apiKey: string,
  input: LLMAnalysisInput,
  options?: OpenAICompatibleOptions
): Promise<AIInsight[]> {
  const endpoint = options?.endpoint || 'https://api.openai.com/v1/chat/completions'
  const model = options?.model || 'gpt-4.1'

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserMessage(input) },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'report_insights',
            description: 'Report performance analysis insights',
            parameters: insightSchema,
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: 'report_insights' } },
    }),
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid API key. Please check your API key.')
    }
    if (response.status === 429) {
      throw new Error('Rate limited. Please wait a moment before trying again.')
    }
    const text = await response.text()
    throw new Error(`API error (${response.status}): ${text}`)
  }

  const data = await response.json()

  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0]
  if (!toolCall?.function?.arguments) {
    throw new Error('Unexpected response format — the model may not support function calling')
  }

  const parsed = JSON.parse(toolCall.function.arguments)
  if (!parsed.insights) {
    throw new Error('Unexpected response format from API')
  }

  return parseInsightsArray(parsed.insights, 'llm')
}

/** @deprecated Use `analyzeWithOpenAICompatible` instead */
export const analyzeWithOpenAI = analyzeWithOpenAICompatible
