import type { AIInsight } from './aiInsights'
import { SYSTEM_PROMPT, buildUserMessage, insightSchema, parseInsightsArray } from './shared'
import type { LLMAnalysisInput } from './shared'

/** @deprecated Use `LLMAnalysisInput` instead */
export type ClaudeAnalysisInput = LLMAnalysisInput

export async function analyzeWithClaude(
  apiKey: string,
  input: LLMAnalysisInput
): Promise<AIInsight[]> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: [
        {
          name: 'report_insights',
          description: 'Report performance analysis insights',
          input_schema: insightSchema,
        },
      ],
      tool_choice: { type: 'tool', name: 'report_insights' },
      messages: [
        { role: 'user', content: buildUserMessage(input) },
      ],
    }),
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid API key. Please check your Anthropic API key.')
    }
    if (response.status === 429) {
      throw new Error('Rate limited. Please wait a moment before trying again.')
    }
    const text = await response.text()
    throw new Error(`API error (${response.status}): ${text}`)
  }

  const data = await response.json()

  const toolBlock = data.content?.find(
    (block: { type: string }) => block.type === 'tool_use'
  )

  if (!toolBlock?.input?.insights) {
    throw new Error('Unexpected response format from Claude API')
  }

  return parseInsightsArray(toolBlock.input.insights, 'claude')
}
