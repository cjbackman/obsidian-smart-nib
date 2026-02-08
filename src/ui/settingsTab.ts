import { App, PluginSettingTab, Setting } from "obsidian";
import type ReviewGeneratorPlugin from "../main";
import type { LLMProvider, PeriodPreset } from "../types";

const PERIOD_PRESETS: { value: PeriodPreset; label: string }[] = [
	{ value: "current_week", label: "Current week" },
	{ value: "current_month", label: "Current month" },
	{ value: "last_7_days", label: "Last 7 days" },
	{ value: "last_30_days", label: "Last 30 days" },
	{ value: "custom", label: "Custom" },
];

export class ReviewSettingsTab extends PluginSettingTab {
	plugin: ReviewGeneratorPlugin;

	constructor(app: App, plugin: ReviewGeneratorPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Folders Section
		new Setting(containerEl).setName("Folders").setHeading();

		new Setting(containerEl)
			.setName("Folders to scan")
			.setDesc(
				"Comma-separated list of folders to scan for notes. Leave empty to scan the whole vault."
			)
			.addText((text) =>
				text
					.setPlaceholder("")
					.setValue(this.plugin.settings.foldersToScan.join(", "))
					.onChange(async (value) => {
						this.plugin.settings.foldersToScan = value
							.split(",")
							.map((s) => s.trim())
							.filter((s) => s.length > 0);
						await this.plugin.saveSettings();
						this.display(); // Refresh to update warning
					})
			);

		if (this.plugin.settings.foldersToScan.length === 0) {
			containerEl.createEl("p", {
				text: "⚠️ no folders specified — the entire vault will be scanned",
				cls: "mod-warning setting-item-description",
			});
		}

		new Setting(containerEl)
			.setName("Output folder")
			.setDesc("Folder where review notes will be created.")
			.addText((text) =>
				text
					.setPlaceholder("")
					.setValue(this.plugin.settings.outputFolder)
					.onChange(async (value) => {
						this.plugin.settings.outputFolder = value;
						await this.plugin.saveSettings();
					})
			);

		// Review Period Section
		new Setting(containerEl).setName("Review period").setHeading();

		new Setting(containerEl)
			.setName("Default period preset")
			.setDesc("The default time range for review generation.")
			.addDropdown((dropdown) => {
				PERIOD_PRESETS.forEach((preset) => {
					dropdown.addOption(preset.value, preset.label);
				});
				dropdown.setValue(this.plugin.settings.defaultPeriodPreset);
				dropdown.onChange(async (value) => {
					this.plugin.settings.defaultPeriodPreset = value as PeriodPreset;
					await this.plugin.saveSettings();
					this.display(); // Refresh to show/hide custom date fields
				});
			});

		if (this.plugin.settings.defaultPeriodPreset === "custom") {
			new Setting(containerEl)
				.setName("Custom start date")
				.setDesc("Start date for custom period.")
				.addText((text) =>
					text
						.setPlaceholder("")
						.setValue(this.plugin.settings.customStartDate ?? "")
						.onChange(async (value) => {
							this.plugin.settings.customStartDate = value || undefined;
							await this.plugin.saveSettings();
						})
				);

			new Setting(containerEl)
				.setName("Custom end date")
				.setDesc("End date for custom period.")
				.addText((text) =>
					text
						.setPlaceholder("")
						.setValue(this.plugin.settings.customEndDate ?? "")
						.onChange(async (value) => {
							this.plugin.settings.customEndDate = value || undefined;
							await this.plugin.saveSettings();
						})
				);
		}

		new Setting(containerEl)
			.setName("Prompt for period on run")
			.setDesc("Show a dialog to select the review period each time the command is run.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.promptForPeriodOnRun).onChange(async (value) => {
					this.plugin.settings.promptForPeriodOnRun = value;
					await this.plugin.saveSettings();
				})
			);

		// LLM Configuration Section
		new Setting(containerEl).setName("Model configuration").setHeading();

		new Setting(containerEl)
			.setName("Provider")
			.setDesc("The model API provider to use.")
			.addDropdown((dropdown) => {
				dropdown.addOption("ollama", "Ollama");
				dropdown.addOption("openai", "Open AI");
				dropdown.setValue(this.plugin.settings.llm.provider);
				dropdown.onChange(async (value) => {
					const provider = value as LLMProvider;
					this.plugin.settings.llm.provider = provider;
					if (provider === "openai") {
						this.plugin.settings.llm.baseUrl = "https://api.openai.com";
						this.plugin.settings.llm.endpointPath = "/v1/chat/completions";
						this.plugin.settings.llm.apiKeyHeaderName = "Authorization";
					} else {
						this.plugin.settings.llm.baseUrl = "http://localhost:11434";
						this.plugin.settings.llm.endpointPath = "/api/chat";
						this.plugin.settings.llm.apiKeyHeaderName = undefined;
						this.plugin.settings.llm.apiKeyHeaderValue = undefined;
					}
					await this.plugin.saveSettings();
					this.display();
				});
			});

		new Setting(containerEl)
			.setName("Base URL")
			.setDesc("The base URL of the model API.")
			.addText((text) =>
				text
					.setPlaceholder("")
					.setValue(this.plugin.settings.llm.baseUrl)
					.onChange(async (value) => {
						this.plugin.settings.llm.baseUrl = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Endpoint path")
			.setDesc("The API endpoint path.")
			.addText((text) =>
				text
					.setPlaceholder("")
					.setValue(this.plugin.settings.llm.endpointPath)
					.onChange(async (value) => {
						this.plugin.settings.llm.endpointPath = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Model name")
			.setDesc("The model to use for generation.")
			.addText((text) =>
				text
					.setPlaceholder("")
					.setValue(this.plugin.settings.llm.model)
					.onChange(async (value) => {
						this.plugin.settings.llm.model = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("API key header name")
			.setDesc("Optional header name for API key authentication.")
			.addText((text) =>
				text
					.setPlaceholder("")
					.setValue(this.plugin.settings.llm.apiKeyHeaderName ?? "")
					.onChange(async (value) => {
						this.plugin.settings.llm.apiKeyHeaderName = value || undefined;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("API key")
			.setDesc("Optional value for the API key header.")
			.addText((text) => {
				text.inputEl.type = "password";
				text
					.setPlaceholder("")
					.setValue(this.plugin.settings.llm.apiKeyHeaderValue ?? "")
					.onChange(async (value) => {
						this.plugin.settings.llm.apiKeyHeaderValue = value || undefined;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Temperature")
			.setDesc("Controls randomness in generation (0.0 - 1.0). Lower = more deterministic.")
			.addSlider((slider) =>
				slider
					.setLimits(0, 1, 0.1)
					.setValue(this.plugin.settings.llm.temperature)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.llm.temperature = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Max tokens")
			.setDesc("Maximum number of tokens in the response.")
			.addText((text) =>
				text
					.setPlaceholder("")
					.setValue(String(this.plugin.settings.llm.maxTokens))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num > 0) {
							this.plugin.settings.llm.maxTokens = num;
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName("Timeout in seconds")
			.setDesc("Maximum time to wait for response.")
			.addText((text) =>
				text
					.setPlaceholder("")
					.setValue(String(this.plugin.settings.llm.timeoutSeconds))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num > 0) {
							this.plugin.settings.llm.timeoutSeconds = num;
							await this.plugin.saveSettings();
						}
					})
			);

		// Payload Limits Section
		new Setting(containerEl).setName("Payload limits").setHeading();

		new Setting(containerEl)
			.setName("Max notes")
			.setDesc("Maximum number of notes to include in the review.")
			.addText((text) =>
				text
					.setPlaceholder("")
					.setValue(String(this.plugin.settings.maxNotes))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num > 0) {
							this.plugin.settings.maxNotes = num;
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName("Max characters per note")
			.setDesc("Maximum characters to include from each note.")
			.addText((text) =>
				text
					.setPlaceholder("")
					.setValue(String(this.plugin.settings.maxCharsPerNote))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num > 0) {
							this.plugin.settings.maxCharsPerNote = num;
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName("System prompt override")
			.setDesc("Optional custom system prompt to use instead of the default.")
			.addTextArea((textarea) =>
				textarea
					.setPlaceholder("Leave empty to use the default system prompt")
					.setValue(this.plugin.settings.systemPromptOverride ?? "")
					.onChange(async (value) => {
						this.plugin.settings.systemPromptOverride = value || undefined;
						await this.plugin.saveSettings();
					})
			);
	}
}
