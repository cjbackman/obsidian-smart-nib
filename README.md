# Weekly Review Generator

An Obsidian plugin that generates weekly review notes using an LLM (supports Ollama and compatible APIs).

## Features

- **Automatic note selection**: Scans notes modified during a configurable review period
- **Flexible time periods**: Current week, current month, last 7 days, last 30 days, or custom range
- **LLM-powered summaries**: Generates a summary, notable work highlights, and exactly 3 priorities
- **Note summarization**: Summarize any individual note with a single command
- **Configurable folders**: Scan specific folders or your entire vault
- **New file every run**: Creates a unique review note each time

## Usage

### Generate a Weekly Review

1. Open the command palette (Cmd/Ctrl + P)
2. Run "Weekly Review: Generate review"
3. Select your review period (if prompted)
4. Wait for the LLM to generate your review

The plugin creates a new note in your configured output folder with the format:
`YYYY-MM-DD Weekly Review.md`

### Summarize a Note

1. Open the note you want to summarize
2. Open the command palette (Cmd/Ctrl + P)
3. Run "Weekly Review: Summarize this note"
4. A `# Summary` section will be added at the top of the note (after frontmatter if present)

Running the command again will replace the existing summary.

## Configuration

### Folders

| Setting | Description | Default |
|---------|-------------|---------|
| Folders to scan | Comma-separated list of folders to include | (entire vault) |
| Output folder | Where review notes are created | `Weekly Reviews` |

### Review Period

| Setting | Description | Default |
|---------|-------------|---------|
| Default period preset | The default time range | Current week |
| Prompt for period on run | Show selection dialog each time | Yes |

### LLM Configuration (Ollama)

This plugin is designed to work with [Ollama](https://ollama.ai/) but supports any compatible API.

| Setting | Description | Default |
|---------|-------------|---------|
| Base URL | LLM API base URL | `http://localhost:11434` |
| Endpoint path | API endpoint | `/api/chat` |
| Model name | Model to use | `llama3.1` |
| Temperature | Randomness (0-1) | 0.2 |
| Max tokens | Response length limit | 1000 |
| Timeout | Request timeout in seconds | 60 |

### Payload Limits

| Setting | Description | Default |
|---------|-------------|---------|
| Max notes | Maximum notes to include | 50 |
| Max chars per note | Excerpt length limit | 6000 |
| System prompt override | Custom system prompt | (none) |

## Setting up Ollama

1. Install Ollama from [ollama.ai](https://ollama.ai/)
2. Pull a model: `ollama pull llama3.1`
3. Ensure Ollama is running: `ollama serve`
4. Configure the plugin settings (defaults should work)

## Output Format

Each review note includes:

**Frontmatter:**
- `week_start`: Monday of the review week
- `period_start`/`period_end`: Exact review period
- `period_preset`: Which preset was used
- `generated_at`: Generation timestamp
- `scanned_folders`: Which folders were included
- `model`: LLM model used

**Sections:**
- Weekly summary
- Notable work
- Priorities for next week (exactly 3)
- Notes reviewed

## Common Errors

| Error | Solution |
|-------|----------|
| "Network error" | Check that Ollama is running (`ollama serve`) |
| "LLM request failed: 404" | Verify the model is installed (`ollama list`) |
| "No notes found" | Check your folder settings and date range |
| Timeout errors | Increase timeout in settings, or use a smaller model |

## Development

```bash
npm install
npm run dev     # Watch mode
npm run build   # Production build
npm run test    # Run tests
npm run lint    # Lint code
```

Pre-commit hooks run lint, test, and build automatically.

## License

0-BSD
