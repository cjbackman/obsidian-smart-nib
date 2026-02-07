import { requestUrl, type RequestUrlParam, type RequestUrlResponse } from "obsidian";
import type { LLMConfig, LLMProvider } from "./types";

/**
 * Custom error class for LLM-related errors.
 */
export class LLMError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "LLMError";
	}
}

/**
 * Ollama chat API response structure.
 */
interface OllamaChatResponse {
	message?: {
		content?: string;
	};
}

/**
 * OpenAI chat API response structure.
 */
interface OpenAIChatResponse {
	choices?: Array<{
		message?: {
			content?: string;
		};
	}>;
}

/**
 * Build the request body for the given provider.
 */
export function buildRequestBody(
	config: LLMConfig,
	prompt: string
): Record<string, unknown> {
	const base = {
		model: config.model,
		messages: [{ role: "user", content: prompt }],
		stream: false,
	};

	if (config.provider === "openai") {
		return {
			...base,
			temperature: config.temperature,
			max_tokens: config.maxTokens,
		};
	}

	// Ollama (default)
	return {
		...base,
		options: {
			temperature: config.temperature,
			num_predict: config.maxTokens,
		},
	};
}

/**
 * Parse the response content based on provider format.
 */
export function parseResponseContent(
	provider: LLMProvider,
	json: unknown
): string {
	if (provider === "openai") {
		const data = json as OpenAIChatResponse;
		const content = data.choices?.[0]?.message?.content;
		if (typeof content !== "string") {
			throw new LLMError("Unexpected response format: missing choices[0].message.content");
		}
		return content;
	}

	// Ollama (default)
	const data = json as OllamaChatResponse;
	const content = data.message?.content;
	if (typeof content !== "string") {
		throw new LLMError("Unexpected response format: missing message content");
	}
	return content;
}

/**
 * Type for the requestUrl function to support dependency injection.
 */
export type RequestUrlFn = (params: RequestUrlParam) => Promise<RequestUrlResponse>;

// Default implementation using Obsidian's requestUrl
let requestUrlImpl: RequestUrlFn = requestUrl;

/**
 * Set a custom requestUrl implementation (for testing).
 */
export function setRequestUrlImpl(impl: RequestUrlFn): void {
	requestUrlImpl = impl;
}

/**
 * Reset to the default requestUrl implementation.
 */
export function resetRequestUrlImpl(): void {
	requestUrlImpl = requestUrl;
}

/**
 * Calls the LLM API with the given prompt.
 *
 * @param config - LLM configuration
 * @param prompt - The prompt to send
 * @returns The LLM response content
 * @throws LLMError on failure
 */
export async function callLLM(config: LLMConfig, prompt: string): Promise<string> {
	const url = `${config.baseUrl}${config.endpointPath}`;

	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};

	if (config.apiKeyHeaderName && config.apiKeyHeaderValue) {
		headers[config.apiKeyHeaderName] = config.apiKeyHeaderValue;
	}

	const body = JSON.stringify(buildRequestBody(config, prompt));

	// Attempt with one retry on network failure
	let lastError: Error | null = null;
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const response = await requestUrlImpl({
				url,
				method: "POST",
				headers,
				body,
				throw: false,
			});

			if (response.status >= 400) {
				throw new LLMError(`LLM request failed: ${response.status}`);
			}

			return parseResponseContent(config.provider, response.json);
		} catch (error) {
			if (error instanceof LLMError) {
				// Don't retry LLM errors (HTTP errors, parse errors)
				throw error;
			}
			// Network error - save for retry
			lastError = error instanceof Error ? error : new Error(String(error));
			if (attempt === 1) {
				throw new LLMError(`Network error after retry: ${lastError.message}`);
			}
		}
	}

	// Should never reach here, but TypeScript needs this
	throw new LLMError(lastError?.message ?? "Unknown error");
}
