/**
 * Unified AI client — switches between Anthropic direct API and AWS Bedrock.
 *
 * AI_PROVIDER=anthropic  (default) → uses ANTHROPIC_API_KEY with Anthropic SDK
 * AI_PROVIDER=bedrock              → uses AWS Bedrock API key via AWS SDK
 *
 * For Bedrock API key auth, set:
 *   AWS_BEDROCK_API_KEY — the bearer token from Bedrock console
 *   AWS_REGION          — region (default: us-east-1)
 *
 * The AWS SDK recognises the env var AWS_BEARER_TOKEN_BEDROCK and automatically
 * authenticates via bearer token instead of SigV4.
 */

import Anthropic from '@anthropic-ai/sdk'
import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime'

// ── Provider detection ────────────────────────────────────────────────────────

export type Provider = 'anthropic' | 'bedrock'

export function getProvider(): Provider {
  const p = (process.env.AI_PROVIDER || 'anthropic').toLowerCase()
  return p === 'bedrock' ? 'bedrock' : 'anthropic'
}

// ── Model ID mapping ──────────────────────────────────────────────────────────

const BEDROCK_MODEL_MAP: Record<string, string> = {
  'claude-opus-4-7':            'us.anthropic.claude-opus-4-5-20251101-v1:0',
  'claude-opus-4-5':            'us.anthropic.claude-opus-4-5-20251101-v1:0',
  'claude-sonnet-4-5':          'us.anthropic.claude-sonnet-4-5-20250514-v1:0',
  'claude-3-5-sonnet-20241022': 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
  'claude-haiku-4-5':           'us.anthropic.claude-haiku-4-5-20251001-v1:0',
  'claude-3-5-haiku-20241022':  'us.anthropic.claude-3-5-haiku-20241022-v1:0',
  'claude-3-haiku-20240307':    'us.anthropic.claude-3-haiku-20240307-v1:0',
}

function resolveModel(model: string): string {
  if (getProvider() !== 'bedrock') return model
  if (model.startsWith('us.') || model.startsWith('global.') || model.startsWith('arn:')) return model
  return BEDROCK_MODEL_MAP[model] || model
}

// ── Shared types ──────────────────────────────────────────────────────────────

export interface AIMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface StreamCallbacks {
  onChunk: (text: string) => void
  onDone:  () => void
  onError: (err: string) => void
}

// ── Anthropic client ──────────────────────────────────────────────────────────

let _anthropic: Anthropic | null = null

function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY required')
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return _anthropic
}

// ── Bedrock client ────────────────────────────────────────────────────────────
// The AWS SDK automatically uses bearer token auth when AWS_BEARER_TOKEN_BEDROCK
// is set as an env var. We set it from our AWS_BEDROCK_API_KEY before creating the client.

let _bedrock: BedrockRuntimeClient | null = null

function getBedrockClient(): BedrockRuntimeClient {
  if (!_bedrock) {
    const apiKey = process.env.AWS_BEDROCK_API_KEY
    const region = process.env.AWS_REGION || 'us-east-1'

    if (!apiKey) throw new Error('AWS_BEDROCK_API_KEY required when AI_PROVIDER=bedrock')

    // Set the env var the AWS SDK looks for to enable bearer token auth
    process.env.AWS_BEARER_TOKEN_BEDROCK = apiKey

    _bedrock = new BedrockRuntimeClient({ region })
  }
  return _bedrock
}

// ── Streaming chat ────────────────────────────────────────────────────────────

export async function streamChat(opts: {
  model:     string
  maxTokens: number
  system:    string
  messages:  AIMessage[]
  callbacks: StreamCallbacks
}): Promise<void> {
  const provider = getProvider()
  const model    = resolveModel(opts.model)
  console.log(`[ai/stream] provider=${provider} model=${model}`)

  if (provider === 'bedrock') {
    await streamBedrock(model, opts)
  } else {
    await streamAnthropic(model, opts)
  }
}

async function streamAnthropic(model: string, opts: {
  maxTokens: number; system: string; messages: AIMessage[]; callbacks: StreamCallbacks
}): Promise<void> {
  try {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model,
      max_tokens: opts.maxTokens,
      system:     opts.system,
      messages:   opts.messages,
    })
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        opts.callbacks.onChunk(event.delta.text)
      }
    }
    opts.callbacks.onDone()
  } catch (e: any) {
    console.error('[ai/stream] anthropic error:', e.message)
    opts.callbacks.onError(e.message || 'Stream failed')
  }
}

async function streamBedrock(model: string, opts: {
  maxTokens: number; system: string; messages: AIMessage[]; callbacks: StreamCallbacks
}): Promise<void> {
  try {
    const client = getBedrockClient()

    const body = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens:        opts.maxTokens,
      system:            opts.system,
      messages:          opts.messages,
    })

    const cmd = new InvokeModelWithResponseStreamCommand({
      modelId:     model,
      contentType: 'application/json',
      accept:      'application/json',
      body:        Buffer.from(body),
    })

    const response = await client.send(cmd)

    if (!response.body) {
      opts.callbacks.onError('No response body from Bedrock')
      return
    }

    for await (const event of response.body) {
      if (event.chunk?.bytes) {
        const decoded = new TextDecoder().decode(event.chunk.bytes)
        try {
          const parsed = JSON.parse(decoded)
          if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
            opts.callbacks.onChunk(parsed.delta.text)
          }
        } catch { /* skip non-JSON chunks */ }
      }
    }

    opts.callbacks.onDone()
  } catch (e: any) {
    console.error('[ai/stream] bedrock error:', e.message)
    opts.callbacks.onError(e.message || 'Bedrock stream failed')
  }
}

// ── Non-streaming inference ───────────────────────────────────────────────────

export async function createMessage(opts: {
  model:     string
  maxTokens: number
  system:    string
  messages:  AIMessage[]
}): Promise<string> {
  const provider = getProvider()
  const model    = resolveModel(opts.model)
  console.log(`[ai/create] provider=${provider} model=${model}`)

  if (provider === 'bedrock') {
    return createBedrock(model, opts)
  }
  return createAnthropic(model, opts)
}

async function createAnthropic(model: string, opts: {
  maxTokens: number; system: string; messages: AIMessage[]
}): Promise<string> {
  const client = getAnthropicClient()
  const res = await client.messages.create({
    model,
    max_tokens: opts.maxTokens,
    system:     opts.system,
    messages:   opts.messages,
  })
  return (res.content[0] as any).text as string
}

async function createBedrock(model: string, opts: {
  maxTokens: number; system: string; messages: AIMessage[]
}): Promise<string> {
  const client = getBedrockClient()

  const body = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens:        opts.maxTokens,
    system:            opts.system,
    messages:          opts.messages,
  })

  const cmd = new InvokeModelCommand({
    modelId:     model,
    contentType: 'application/json',
    accept:      'application/json',
    body:        Buffer.from(body),
  })

  const response = await client.send(cmd)
  const decoded  = new TextDecoder().decode(response.body)
  const parsed   = JSON.parse(decoded)
  return parsed.content?.[0]?.text as string
}
