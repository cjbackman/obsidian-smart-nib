import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { LLMConfig } from "./types";
import { buildRequestBody, callLLM, LLMError, parseResponseContent, setRequestUrlImpl, resetRequestUrlImpl, type RequestUrlFn } from "./llmClient";
import type { RequestUrlParam, RequestUrlResponse } from "obsidian";

// Mock requestUrl function
const mockRequestUrl = vi.fn<RequestUrlFn>();

describe("callLLM", () => {
	const baseConfig: LLMConfig = {
		provider: "ollama",
		baseUrl: "http://localhost:11434",
		endpointPath: "/api/chat",
		model: "llama3.1",
		temperature: 0.2,
		maxTokens: 1000,
		timeoutSeconds: 60,
	};

	beforeEach(() => {
		vi.clearAllMocks();
		setRequestUrlImpl(mockRequestUrl);
	});

	afterEach(() => {
		resetRequestUrlImpl();
	});

	describe("successful requests", () => {
		it("returns LLM response content on success", async () => {
			const mockResponse = {
				message: {
					content: "## Weekly summary\nThis was a productive week.",
				},
			};
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: mockResponse,
			} as RequestUrlResponse);

			const result = await callLLM(baseConfig, "Test prompt");

			expect(result).toBe("## Weekly summary\nThis was a productive week.");
		});

		it("sends correct request body", async () => {
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: { message: { content: "Response" } },
			} as RequestUrlResponse);

			await callLLM(baseConfig, "Test prompt");

			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					url: "http://localhost:11434/api/chat",
					method: "POST",
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					headers: expect.objectContaining({
						"Content-Type": "application/json",
					}),
				})
			);

			const calls = mockRequestUrl.mock.calls as [RequestUrlParam][];
			const callArgs = calls[0]![0];
			const body = JSON.parse(callArgs.body as string) as {
				options: { temperature: number; num_predict: number };
				stream: boolean;
			};
			expect(body.options.temperature).toBe(0.2);
			expect(body.options.num_predict).toBe(1000);
			expect(body.stream).toBe(false);
		});

		it("includes API key header when configured", async () => {
			const configWithApiKey: LLMConfig = {
				...baseConfig,
				apiKeyHeaderName: "Authorization",
				apiKeyHeaderValue: "Bearer test-key",
			};
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: { message: { content: "Response" } },
			} as RequestUrlResponse);

			await callLLM(configWithApiKey, "Test prompt");

			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					headers: expect.objectContaining({
						Authorization: "Bearer test-key",
					}),
				})
			);
		});
	});

	describe("error handling", () => {
		it("throws LLMError on HTTP error response", async () => {
			mockRequestUrl.mockResolvedValueOnce({
				status: 500,
				json: {},
			} as RequestUrlResponse);

			await expect(callLLM(baseConfig, "Test prompt")).rejects.toThrow(LLMError);
			mockRequestUrl.mockResolvedValueOnce({
				status: 500,
				json: {},
			} as RequestUrlResponse);
			await expect(callLLM(baseConfig, "Test prompt")).rejects.toThrow(/500/);
		});

		it("throws LLMError when response missing message content", async () => {
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: { unexpected: "format" },
			} as RequestUrlResponse);

			await expect(callLLM(baseConfig, "Test prompt")).rejects.toThrow(LLMError);
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: { unexpected: "format" },
			} as RequestUrlResponse);
			await expect(callLLM(baseConfig, "Test prompt")).rejects.toThrow(/unexpected response/i);
		});
	});

	describe("OpenAI provider", () => {
		const openaiConfig: LLMConfig = {
			provider: "openai",
			baseUrl: "https://api.openai.com",
			endpointPath: "/v1/chat/completions",
			model: "gpt-4o",
			apiKeyHeaderName: "Authorization",
			apiKeyHeaderValue: "Bearer sk-test",
			temperature: 0.5,
			maxTokens: 2000,
			timeoutSeconds: 60,
		};

		it("sends OpenAI request body format", async () => {
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: { choices: [{ message: { content: "Response" } }] },
			} as RequestUrlResponse);

			await callLLM(openaiConfig, "Test prompt");

			const calls = mockRequestUrl.mock.calls as [RequestUrlParam][];
			const callArgs = calls[0]![0];
			const body = JSON.parse(callArgs.body as string) as Record<string, unknown>;
			expect(body.temperature).toBe(0.5);
			expect(body.max_tokens).toBe(2000);
			expect(body).not.toHaveProperty("options");
			expect(body.stream).toBe(false);
		});

		it("parses OpenAI response format", async () => {
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: { choices: [{ message: { content: "OpenAI response" } }] },
			} as RequestUrlResponse);

			const result = await callLLM(openaiConfig, "Test prompt");

			expect(result).toBe("OpenAI response");
		});

		it("throws on missing choices in OpenAI response", async () => {
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: { message: { content: "wrong format" } },
			} as RequestUrlResponse);

			await expect(callLLM(openaiConfig, "Test prompt")).rejects.toThrow(
				/choices\[0\]\.message\.content/
			);
		});
	});

	describe("buildRequestBody", () => {
		it("builds Ollama format with options", () => {
			const body = buildRequestBody(baseConfig, "hello");
			const options = body.options as Record<string, unknown>;
			expect(options.temperature).toBe(0.2);
			expect(options.num_predict).toBe(1000);
			expect(body).not.toHaveProperty("temperature");
			expect(body).not.toHaveProperty("max_tokens");
		});

		it("builds OpenAI format with top-level params", () => {
			const openaiConfig: LLMConfig = { ...baseConfig, provider: "openai" };
			const body = buildRequestBody(openaiConfig, "hello");
			expect(body.temperature).toBe(0.2);
			expect(body.max_tokens).toBe(1000);
			expect(body).not.toHaveProperty("options");
		});
	});

	describe("parseResponseContent", () => {
		it("parses Ollama response", () => {
			expect(parseResponseContent("ollama", { message: { content: "ok" } })).toBe("ok");
		});

		it("parses OpenAI response", () => {
			expect(parseResponseContent("openai", { choices: [{ message: { content: "ok" } }] })).toBe("ok");
		});

		it("throws on invalid Ollama response", () => {
			expect(() => parseResponseContent("ollama", {})).toThrow(/message content/);
		});

		it("throws on invalid OpenAI response", () => {
			expect(() => parseResponseContent("openai", {})).toThrow(/choices/);
		});
	});

	describe("retry logic", () => {
		it("retries once on network failure", async () => {
			mockRequestUrl
				.mockRejectedValueOnce(new Error("Network error"))
				.mockResolvedValueOnce({
					status: 200,
					json: { message: { content: "Success on retry" } },
				} as RequestUrlResponse);

			const result = await callLLM(baseConfig, "Test prompt");

			expect(result).toBe("Success on retry");
			expect(mockRequestUrl).toHaveBeenCalledTimes(2);
		});

		it("does not retry more than once", async () => {
			mockRequestUrl
				.mockRejectedValueOnce(new Error("Network error 1"))
				.mockRejectedValueOnce(new Error("Network error 2"));

			await expect(callLLM(baseConfig, "Test prompt")).rejects.toThrow(LLMError);
			expect(mockRequestUrl).toHaveBeenCalledTimes(2);
		});

		it("does not retry on HTTP error (non-network failure)", async () => {
			mockRequestUrl.mockResolvedValueOnce({
				status: 400,
				json: {},
			} as RequestUrlResponse);

			await expect(callLLM(baseConfig, "Test prompt")).rejects.toThrow(LLMError);
			expect(mockRequestUrl).toHaveBeenCalledTimes(1);
		});
	});

});
