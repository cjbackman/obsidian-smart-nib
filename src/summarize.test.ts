import { describe, it, expect } from "vitest";
import { buildSummaryPrompt, insertSummarySection } from "./summarize";

describe("buildSummaryPrompt", () => {
	it("includes note title in prompt", () => {
		const prompt = buildSummaryPrompt("Some content here", "My Note Title");

		expect(prompt).toContain("My Note Title");
	});

	it("includes note content in prompt", () => {
		const content = "This is the note content with important information.";
		const prompt = buildSummaryPrompt(content, "Title");

		expect(prompt).toContain(content);
	});

	it("instructs model to output markdown only", () => {
		const prompt = buildSummaryPrompt("content", "title");

		expect(prompt.toLowerCase()).toContain("markdown");
	});

	it("instructs model to be concise", () => {
		const prompt = buildSummaryPrompt("content", "title");

		expect(prompt.toLowerCase()).toMatch(/concise|brief|short/);
	});

	it("specifies summary length guidance", () => {
		const prompt = buildSummaryPrompt("content", "title");

		// Should mention sentence count or similar length guidance
		expect(prompt).toMatch(/2-4 sentences|few sentences|2 to 4 sentences/i);
	});
});

describe("insertSummarySection", () => {
	describe("notes without frontmatter", () => {
		it("inserts summary at top of empty note", () => {
			const result = insertSummarySection("", "This is the summary.");

			expect(result).toBe("# Summary\n\nThis is the summary.\n");
		});

		it("inserts summary before existing content", () => {
			const content = "# My Note\n\nSome content here.";
			const result = insertSummarySection(content, "This is the summary.");

			expect(result).toBe(
				"# Summary\n\nThis is the summary.\n\n# My Note\n\nSome content here."
			);
		});

		it("inserts summary before content with only text", () => {
			const content = "Just some plain text content.";
			const result = insertSummarySection(content, "Summary text.");

			expect(result).toBe("# Summary\n\nSummary text.\n\nJust some plain text content.");
		});
	});

	describe("notes with frontmatter", () => {
		it("inserts summary after frontmatter", () => {
			const content = `---
title: My Note
date: 2025-01-01
---

# My Note

Content here.`;
			const result = insertSummarySection(content, "This is the summary.");

			expect(result).toBe(`---
title: My Note
date: 2025-01-01
---

# Summary

This is the summary.

# My Note

Content here.`);
		});

		it("handles frontmatter with no content after", () => {
			const content = `---
title: Empty Note
---`;
			const result = insertSummarySection(content, "Summary of empty note.");

			expect(result).toBe(`---
title: Empty Note
---

# Summary

Summary of empty note.
`);
		});

		it("handles frontmatter with only whitespace after", () => {
			const content = `---
title: Note
---

`;
			const result = insertSummarySection(content, "The summary.");

			expect(result).toBe(`---
title: Note
---

# Summary

The summary.
`);
		});
	});

	describe("replacing existing summary", () => {
		it("replaces existing summary section content", () => {
			const content = `# Summary
Old summary content.

## Other Section
Other content.`;
			const result = insertSummarySection(content, "New summary content.");

			expect(result).toBe(`# Summary

New summary content.

## Other Section
Other content.`);
		});

		it("replaces summary when it is the only section", () => {
			const content = `# Summary
Old summary that should be replaced.`;
			const result = insertSummarySection(content, "Brand new summary.");

			expect(result).toBe(`# Summary

Brand new summary.
`);
		});

		it("replaces summary after frontmatter", () => {
			const content = `---
title: Note
---

# Summary
Old summary.

## Content
Main content here.`;
			const result = insertSummarySection(content, "Updated summary.");

			expect(result).toBe(`---
title: Note
---

# Summary

Updated summary.

## Content
Main content here.`);
		});

		it("preserves content between summary and next h2", () => {
			const content = `# Summary
Old summary.

Some paragraph under summary.

## Next Section
Content.`;
			const result = insertSummarySection(content, "New summary.");

			// The old content under summary gets replaced
			expect(result).toBe(`# Summary

New summary.

## Next Section
Content.`);
		});
	});

	describe("notes with other h2 sections", () => {
		it("does not affect other h2 sections", () => {
			const content = `## Introduction
This is the intro.

## Details
These are details.`;
			const result = insertSummarySection(content, "Summary text.");

			expect(result).toBe(`# Summary

Summary text.

## Introduction
This is the intro.

## Details
These are details.`);
		});

		it("inserts summary before first h2 when no summary exists", () => {
			const content = `---
title: Note
---

## First Section
Content.`;
			const result = insertSummarySection(content, "The summary.");

			expect(result).toBe(`---
title: Note
---

# Summary

The summary.

## First Section
Content.`);
		});
	});

	describe("edge cases", () => {
		it("handles summary with multiple paragraphs", () => {
			const content = "# Note\n\nContent.";
			const summary = "First paragraph.\n\nSecond paragraph.";
			const result = insertSummarySection(content, summary);

			expect(result).toBe(`# Summary

First paragraph.

Second paragraph.

# Note

Content.`);
		});

		it("handles summary with special characters", () => {
			const content = "# Note";
			const summary = "Summary with **bold** and [[wikilink]] and `code`.";
			const result = insertSummarySection(content, summary);

			expect(result).toBe(`# Summary

Summary with **bold** and [[wikilink]] and \`code\`.

# Note`);
		});

		it("trims whitespace from summary", () => {
			const content = "# Note";
			const result = insertSummarySection(content, "  Summary with spaces.  \n\n");

			expect(result).toBe(`# Summary

Summary with spaces.

# Note`);
		});

		it("handles case-insensitive summary heading match", () => {
			const content = `## SUMMARY
Old content.

## Other
More content.`;
			const result = insertSummarySection(content, "New summary.");

			expect(result).toBe(`# Summary

New summary.

## Other
More content.`);
		});
	});
});
