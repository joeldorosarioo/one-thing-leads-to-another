# Note Template Sync

Edit structured data in Obsidian's right sidebar and generate a Markdown note from a reusable template. Each connection links a JSON data source, a Markdown template and a generated note. The files stay in your vault, and the generated note contains ordinary Markdown. No accounts or external services are required.

**Version:** 0.5.3 | **Status:** release candidate, not yet community-approved | **Platform:** desktop preview.

## Why this exists

I built this for my own Obsidian notes. I wanted to change a value once and keep every total and repeated reference up to date. My first use case was a financial planning note with recurring amounts, calculations, tables and goals.

Putting editable controls inside the report made it harder to read. Repeating the same numbers across notes made it easy to miss an update. I wanted to maintain the data beside the document and read the result as a normal note.

The same workflow also works for project notes, recurring summaries, goal trackers and other notes built from structured values.

## Why the repository name?

`one-thing-leads-to-another` is a nod to ["One Thing Leads to Another" by The Fixx](https://www.youtube.com/watch?v=JHYIGy1dyd8). It also fits the plugin's workflow: change one value, and the calculations and generated note follow.

## Features

- A visual editor in the right sidebar, with searchable fields and collapsible sections.
- Number, text, date and boolean fields, plus arithmetic formulas using `+`, `-`, `*`, `/`, `%`, `sum`, `min`, `max`, `round`, `ceil`, `floor` and `abs`. Formulas do not run arbitrary JavaScript.
- A portable JSON data source, created automatically or selected from an existing file.
- Vault-relative paths for templates and generated notes, with rename tracking while Obsidian is running.
- Automatic sync that updates the note after source or template changes. With Auto-sync off, source edits save and the note waits for manual Sync.
- A Sync button that becomes available for pending changes when Auto-sync is off, or when external edits need review. It is disabled when the note is up to date.
- Confirmation before replacing a generated note that was edited outside the plugin.
- Locale and currency settings for each connection, with search and a formatting preview.
- Optional color roles for financial and other numeric indicators.

## Install a development build

1. Back up your vault before installing an unpublished build.
2. Copy `main.js`, `manifest.json` and `styles.css` to `<vault>/.obsidian/plugins/note-template-sync/`.
3. Restart Obsidian and enable **Note Template Sync** under **Settings > Community plugins**.
4. Run **Note Template Sync: Open data editor** from the command palette.
5. Select **New connection**. Enter a name, a template path and a generated-note path. Set the locale and currency if needed; the plugin creates the JSON source for you.
6. Add fields in the editor and reference them in the template. Open the generated note alongside the editor to see the result.

Use the advanced **Use existing JSON** option to select a portable data file you already have.

### How syncing works

Field edits save to JSON when you finish editing by leaving the field or pressing Enter. With Auto-sync enabled, the plugin updates the generated note after a short delay. Turning Auto-sync off cancels a queued update; later edits still save to JSON.

Manual Sync updates the note when the source and template produce different output. If the note contains external edits, its status becomes **Review external changes** and the plugin asks for confirmation before overwriting it. Put free-form writing in the template if it should appear in each generated version.

Synchronization runs while Obsidian is open. Rename tracking applies to moves made inside Obsidian.

### Portable JSON format

```json
{
  "schema_version": 1,
  "locale": "en-US",
  "currency": "USD",
  "fields": [
    {
      "key": "note_title",
      "label": "Note title",
      "section": "Overview",
      "type": "text",
      "tone": "none",
      "value": "My notes"
    },
    {
      "key": "tasks_total",
      "label": "Tasks planned",
      "section": "Progress",
      "type": "number",
      "tone": "none",
      "value": 5
    },
    {
      "key": "tasks_done",
      "label": "Tasks completed",
      "section": "Progress",
      "type": "number",
      "tone": "none",
      "value": 2
    }
  ],
  "formulas": [
    {
      "key": "tasks_remaining",
      "label": "Tasks remaining",
      "expression": "max(0, tasks_total - tasks_done)",
      "tone": "pending"
    }
  ]
}
```

Use `snake_case` for field keys.

### Template syntax

```md
# {{text:note_title}}

Tasks planned: {{integer:tasks_total}}
Tasks completed: {{integer:tasks_done}}
Tasks remaining: **{{integer:tasks_remaining:pending}}**
```

Supported render types are `text`, `number`, `decimal`, `integer`, `money`, `duration`, `duration_long` and `boolean`. Optional color suffixes are `income`, `expense`, `investment`, `pending` and `auto`.

See `examples/connected-notes/` for a complete example.

## Developing

Use Node.js 22 or newer and the pnpm version declared in `package.json`:

```sh
pnpm install --frozen-lockfile
pnpm run check
```

See [Contributing](CONTRIBUTING.md) for the development workflow and code structure.

## Upgrading from v0.4.x

Follow the [upgrade instructions](CHANGELOG.md#upgrading-from-04x) to preserve your existing connections and data.

## Releasing

See [Releasing](CONTRIBUTING.md#releasing) for release and community submission instructions.

## License

MIT. See [LICENSE](LICENSE).
