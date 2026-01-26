/**
 * Builds the prompt for summarizing a note.
 *
 * @param noteContent - The full content of the note
 * @param noteTitle - The title of the note
 * @returns The prompt string to send to the LLM
 */
export function buildSummaryPrompt(noteContent: string, noteTitle: string): string {
	return `You are a helpful assistant that summarizes notes concisely.

## Task
Summarize the following note in 2-4 sentences. Focus on the key points and main takeaways.

## Instructions
- Output markdown only - no code blocks, no explanations, no preamble
- Be concise and direct
- Capture the essence of the note
- Do not include a heading - just the summary text

## Note Title
${noteTitle}

## Note Content
${noteContent}

## Summary`;
}

/**
 * Inserts or replaces a # Summary section in a note.
 *
 * @param content - The current note content
 * @param summary - The summary text to insert
 * @returns The updated note content with the summary section
 */
export function insertSummarySection(content: string, summary: string): string {
	const trimmedSummary = summary.trim();
	const summarySection = `# Summary\n\n${trimmedSummary}`;

	// Check if content has frontmatter
	const frontmatterMatch = content.match(/^---\n[\s\S]*?\n---/);
	const hasFrontmatter = frontmatterMatch !== null;

	let frontmatter = "";
	let bodyContent = content;

	if (hasFrontmatter) {
		frontmatter = frontmatterMatch[0];
		bodyContent = content.slice(frontmatter.length);
	}

	// Check if there's an existing summary section (case-insensitive)
	// Match # Summary or ## Summary heading to the next heading or end of content
	const summaryRegex = /##? summary[\s\S]*?(?=\n#+ |$)/i;
	const existingSummaryMatch = bodyContent.match(summaryRegex);

	if (existingSummaryMatch) {
		// Replace existing summary
		const beforeSummary = bodyContent.slice(0, existingSummaryMatch.index);
		const afterSummary = bodyContent.slice(
			(existingSummaryMatch.index ?? 0) + existingSummaryMatch[0].length
		);

		// Clean up: afterSummary might start with newlines before next section
		const cleanAfter = afterSummary.replace(/^\n+/, "");

		if (cleanAfter) {
			bodyContent = beforeSummary + summarySection + "\n\n" + cleanAfter;
		} else {
			bodyContent = beforeSummary + summarySection + "\n";
		}
	} else {
		// Insert new summary section
		const trimmedBody = bodyContent.trim();

		if (trimmedBody) {
			// There's content after frontmatter - insert summary before it
			bodyContent = "\n\n" + summarySection + "\n\n" + trimmedBody;
		} else {
			// No content after frontmatter
			bodyContent = "\n\n" + summarySection + "\n";
		}
	}

	if (hasFrontmatter) {
		return frontmatter + bodyContent;
	} else {
		// No frontmatter - remove leading newlines we added
		return bodyContent.replace(/^\n+/, "");
	}
}
