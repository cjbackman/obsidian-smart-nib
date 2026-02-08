import { type Editor, Notice, Plugin, TFile } from "obsidian";
import { DEFAULT_SETTINGS, type ReviewSettings, type CustomRange } from "./types";
import { ReviewSettingsTab } from "./ui/settingsTab";
import { PeriodModal, type PeriodModalResult } from "./ui/periodModal";
import { SprinklePromptModal } from "./ui/sprinklePromptModal";
import {
	SprinkleReviewModal,
	type SprinkleReviewResult,
} from "./ui/sprinkleReviewModal";
import { ObsidianVaultAdapter } from "./vaultAdapter";
import { resolvePeriod } from "./period";
import { scanNotes } from "./scan";
import { buildEvidencePack } from "./evidence";
import { buildPrompt } from "./prompt";
import { callLLM, LLMError } from "./llmClient";
import { renderReviewNote, getWeekStart } from "./render";
import { resolveFilename } from "./filenames";
import { buildSummaryPrompt, insertSummarySection } from "./summarize";
import { buildSprinklePrompt } from "./sprinkle";

export default class ReviewGeneratorPlugin extends Plugin {
	settings: ReviewSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();

		// Add the generate review command
		this.addCommand({
			id: "generate-review",
			name: "Generate review",
			callback: () => this.generateReview(),
		});

		// Add the summarize note command
		this.addCommand({
			id: "summarize-note",
			name: "Summarize this note",
			editorCallback: (editor, ctx) => this.summarizeCurrentNote(ctx.file),
		});

		// Add "Sprinkle AI" context menu item
		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor) => {
				if (editor.somethingSelected()) {
					menu.addItem((item) => {
						item.setTitle("Sprinkle AI")
							.onClick(() => this.sprinkleAI(editor));
					});
				}
			})
		);

		// Add settings tab
		this.addSettingTab(new ReviewSettingsTab(this.app, this));
	}

	onunload() {
		// Cleanup if needed
	}

	async loadSettings() {
		const data = (await this.loadData()) as Partial<ReviewSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
		// Ensure nested objects are properly merged
		if (data?.llm) {
			this.settings.llm = Object.assign({}, DEFAULT_SETTINGS.llm, data.llm);
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private async generateReview() {
		const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		const now = new Date();

		try {
			// Step 1: Get period selection
			let preset = this.settings.defaultPeriodPreset;
			let customRange: CustomRange | undefined;

			if (this.settings.promptForPeriodOnRun) {
				const modalResult = await this.showPeriodModal();
				if (!modalResult) {
					// User cancelled
					return;
				}

				preset = modalResult.preset;
				customRange = modalResult.customRange;

				// Save as default if requested
				if (modalResult.saveAsDefault) {
					this.settings.defaultPeriodPreset = preset;
					if (customRange) {
						this.settings.customStartDate = customRange.start.toISOString();
						this.settings.customEndDate = customRange.end.toISOString();
					}
					await this.saveSettings();
				}
			} else if (preset === "custom") {
				// Use saved custom dates
				if (this.settings.customStartDate && this.settings.customEndDate) {
					customRange = {
						start: new Date(this.settings.customStartDate),
						end: new Date(this.settings.customEndDate),
					};
				} else {
					new Notice(
						"Custom period selected but no dates configured. Please update settings.",
						0
					);
					return;
				}
			}

			// Step 2: Resolve period
			new Notice("Generating review...");

			const period = resolvePeriod(preset, customRange, now, timezone);

			// Step 3: Scan notes
			const vault = new ObsidianVaultAdapter(this.app);
			const notes = await scanNotes(
				vault,
				this.settings.foldersToScan,
				period.start,
				period.end
			);

			if (notes.length === 0) {
				new Notice("No notes found for the selected period.", 0);
				return;
			}

			// Step 4: Build evidence pack
			const evidence = buildEvidencePack(
				notes,
				this.settings.maxNotes,
				this.settings.maxCharsPerNote
			);

			// Step 5: Build prompt and call LLM
			const prompt = buildPrompt(evidence, period, this.settings.systemPromptOverride);
			const llmResponse = await callLLM(this.settings.llm, prompt);

			// Step 6: Render the review note
			const metadata = {
				weekStart: getWeekStart(period.start, timezone),
				periodStart: period.start.toISOString(),
				periodEnd: period.end.toISOString(),
				periodPreset: period.preset,
				generatedAt: now.toISOString(),
				scannedFolders:
					this.settings.foldersToScan.length > 0
						? this.settings.foldersToScan
						: ["(entire vault)"],
				model: this.settings.llm.model,
			};

			const noteContent = renderReviewNote(llmResponse, period, metadata);

			// Step 7: Create the file
			const existingFiles = (await vault.listMarkdownFiles()).map((f) => f.path);
			const filename = resolveFilename(this.settings.outputFolder, now, existingFiles, timezone);

			await vault.createFile(filename, noteContent);

			// Success!
			new Notice(`Review created: ${filename}`);

			// Open the new file
			const file = this.app.vault.getAbstractFileByPath(filename);
			if (file instanceof TFile) {
				await this.app.workspace.getLeaf().openFile(file);
			}
		} catch (error) {
			if (error instanceof LLMError) {
				new Notice(`LLM Error: ${error.message}`, 0);
			} else if (error instanceof Error) {
				new Notice(`Error: ${error.message}`, 0);
			} else {
				new Notice("An unexpected error occurred.", 0);
			}
			console.error("Review generation failed:", error);
		}
	}

	private showPeriodModal(): Promise<PeriodModalResult | null> {
		return new Promise((resolve) => {
			const modal = new PeriodModal(
				this.app,
				this.settings.defaultPeriodPreset,
				(result) => resolve(result)
			);
			modal.open();
		});
	}

	private showSprinklePromptModal(initialValue = ""): Promise<string | null> {
		return new Promise((resolve) => {
			const modal = new SprinklePromptModal(this.app, initialValue, (result) =>
				resolve(result)
			);
			modal.open();
		});
	}

	private showSprinkleReviewModal(response: string): Promise<SprinkleReviewResult> {
		return new Promise((resolve) => {
			const modal = new SprinkleReviewModal(this.app, response, (result) =>
				resolve(result)
			);
			modal.open();
		});
	}

	private async sprinkleAI(editor: Editor) {
		const selectedText = editor.getSelection();
		const selectionFrom = editor.getCursor("from");

		let userPrompt = await this.showSprinklePromptModal();
		if (userPrompt === null) return;

		try {
			let done = false;
			while (!done) {
				const prompt = buildSprinklePrompt(userPrompt, selectedText);

				new Notice("Sprinkling AI...");
				const response = await callLLM(this.settings.llm, prompt);

				const decision = await this.showSprinkleReviewModal(response);

				switch (decision) {
					case "accept":
						editor.replaceRange(response + "\n\n", selectionFrom);
						done = true;
						break;
					case "retry": {
						const edited = await this.showSprinklePromptModal(userPrompt);
						if (edited === null) {
							done = true;
						} else {
							userPrompt = edited;
						}
						break;
					}
					case "reject":
						done = true;
						break;
				}
			}
		} catch (error) {
			if (error instanceof LLMError) {
				new Notice(`LLM Error: ${error.message}`, 0);
			} else if (error instanceof Error) {
				new Notice(`Error: ${error.message}`, 0);
			} else {
				new Notice("An unexpected error occurred.", 0);
			}
			console.error("Sprinkle AI failed:", error);
		}
	}

	private async summarizeCurrentNote(file: TFile | null) {
		if (!file) {
			new Notice("No active file to summarize.", 0);
			return;
		}

		try {
			new Notice("Summarizing note...");

			const content = await this.app.vault.read(file);
			const title = file.basename;

			const prompt = buildSummaryPrompt(content, title);
			const summary = await callLLM(this.settings.llm, prompt);

			const updatedContent = insertSummarySection(content, summary);

			await this.app.vault.modify(file, updatedContent);

			new Notice("Summary added to note.");
		} catch (error) {
			if (error instanceof LLMError) {
				new Notice(`LLM Error: ${error.message}`, 0);
			} else if (error instanceof Error) {
				new Notice(`Error: ${error.message}`, 0);
			} else {
				new Notice("An unexpected error occurred.", 0);
			}
			console.error("Note summarization failed:", error);
		}
	}
}
