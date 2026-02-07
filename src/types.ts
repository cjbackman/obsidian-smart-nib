/**
 * Review period presets supported by the plugin.
 */
export type PeriodPreset =
	| "current_week"
	| "current_month"
	| "last_7_days"
	| "last_30_days"
	| "custom";

/**
 * A custom date range for the review period.
 */
export interface CustomRange {
	start: Date;
	end: Date;
}

/**
 * A resolved review period with concrete dates.
 */
export interface ReviewPeriod {
	start: Date;
	end: Date;
	label: string;
	preset: PeriodPreset;
}

/**
 * Metadata about a note in the vault.
 */
export interface NoteMetadata {
	path: string;
	title: string;
	mtime: Date;
	content: string;
}

/**
 * A single note prepared for the LLM with truncated content.
 */
export interface EvidenceNote {
	path: string;
	title: string;
	modified: string; // ISO string
	excerpt: string;
}

/**
 * The complete evidence pack sent to the LLM.
 */
export interface EvidencePack {
	notes: EvidenceNote[];
	totalNotesScanned: number;
	notesIncluded: number;
}

/**
 * Supported LLM API providers.
 */
export type LLMProvider = "ollama" | "openai";

/**
 * LLM API configuration.
 */
export interface LLMConfig {
	provider: LLMProvider;
	baseUrl: string;
	endpointPath: string;
	model: string;
	apiKeyHeaderName?: string;
	apiKeyHeaderValue?: string;
	temperature: number;
	maxTokens: number;
	timeoutSeconds: number;
}

/**
 * Plugin settings persisted to disk.
 */
export interface ReviewSettings {
	// Folders
	foldersToScan: string[];
	outputFolder: string;

	// Review period
	defaultPeriodPreset: PeriodPreset;
	customStartDate?: string; // ISO string
	customEndDate?: string; // ISO string
	promptForPeriodOnRun: boolean;

	// LLM configuration
	llm: LLMConfig;

	// Payload limits
	maxNotes: number;
	maxCharsPerNote: number;
	systemPromptOverride?: string;
}

/**
 * Default settings for the plugin.
 */
export const DEFAULT_SETTINGS: ReviewSettings = {
	foldersToScan: [],
	outputFolder: "Weekly Reviews",
	defaultPeriodPreset: "current_week",
	promptForPeriodOnRun: true,
	llm: {
		provider: "ollama",
		baseUrl: "http://localhost:11434",
		endpointPath: "/api/chat",
		model: "llama3.1",
		temperature: 0.2,
		maxTokens: 1000,
		timeoutSeconds: 60,
	},
	maxNotes: 50,
	maxCharsPerNote: 6000,
};

/**
 * Metadata for the generated review note.
 */
export interface ReviewNoteMetadata {
	weekStart: string; // YYYY-MM-DD, Monday of week containing period.start
	periodStart: string; // ISO
	periodEnd: string; // ISO
	periodPreset: PeriodPreset;
	generatedAt: string; // ISO
	scannedFolders: string[];
	model: string;
}

/**
 * Abstraction over the Obsidian vault for testability.
 */
export interface VaultAdapter {
	listMarkdownFiles(): Promise<Array<{ path: string; mtime: Date }>>;
	readFile(path: string): Promise<string>;
	createFile(path: string, content: string): Promise<void>;
	fileExists(path: string): Promise<boolean>;
	listFilesInFolder(folder: string): Promise<string[]>;
}
