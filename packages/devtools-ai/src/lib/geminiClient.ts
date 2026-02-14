import type { AIInsight } from './aiInsights'
import { SYSTEM_PROMPT, buildUserMessage, insightSchema, parseInsightsArray } from './shared'
import type { LLMAnalysisInput } from './shared'

function jsonSchemaToGeminiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(schema)) {
    if (key === 'required') continue
    if (key === 'properties' && typeof value === 'object' && value !== null) {
      const props: Record<string, unknown> = {}
      for (const [propKey, propValue] of Object.entries(value as Record<string, unknown>)) {
        props[propKey] = jsonSchemaToGeminiSchema(propValue as Record<string, unknown>)
      }
      result[key] = props
    } else if (key === 'items' && typeof value === 'object' && value !== null) {
      result[key] = jsonSchemaToGeminiSchema(value as Record<string, unknown>)
    } else {
      result[key] = value
    }
  }
  return result
}

export async function analyzeWithGemini(
  apiKey: string,
  input: LLMAnalysisInput
): Promise<AIInsight[]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: buildUserMessage(input) }],
          },
        ],
        tools: [
          {
            functionDeclarations: [
              {
                name: 'report_insights',
                description: 'Report performance analysis insights',
                parameters: jsonSchemaToGeminiSchema(insightSchema),
              },
            ],
          },
        ],
        toolConfig: {
          functionCallingConfig: {
            mode: 'ANY',
            allowedFunctionNames: ['report_insights'],
          },
        },
      }),
    }
  )

  if (!response.ok) {
    if (response.status === 400 || response.status === 403) {
      throw new Error('Invalid API key. Please check your Google AI API key.')
    }
    if (response.status === 429) {
      throw new Error('Rate limited. Please wait a moment before trying again.')
    }
    const text = await response.text()
    throw new Error(`API error (${response.status}): ${text}`)
  }

  const data = await response.json()

  const part = data.candidates?.[0]?.content?.parts?.find(
    (p: { functionCall?: unknown }) => p.functionCall
  )

  if (!part?.functionCall?.args?.insights) {
    throw new Error('Unexpected response format from Gemini API')
  }

  return parseInsightsArray(part.functionCall.args.insights, 'gemini')
}
