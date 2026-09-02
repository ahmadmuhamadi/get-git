# Get Git

<p align="center">
  <img src="images/icon.png" width="128" height="128" alt="Get Git logo" />
</p>

Browse any public GitHub or GitLab repository directly inside VS Code — no cloning, no disk usage. Get Git mounts the repo as a **read-only** workspace folder so you get real editor navigation (Explorer, `Ctrl+P` go-to-file, tabs, breadcrumbs, syntax highlighting) instead of GitHub/GitLab's web UI.

## Why

Reading through a large open-source codebase on GitHub's web UI is painful — no real go-to-file, inconsistent syntax highlighting, no editor keybindings. Cloning a huge repo just to read three files wastes disk and time. Get Git fetches only the file tree up front, then lazily fetches file contents as you open them.

## Usage

1. Run **Get Git: Open Repository** from the Command Palette (`Ctrl+Shift+P`).
2. Enter a repository. Any of these work:
   - Shorthand: `sharkdp/bat`
   - A full GitHub URL: `https://github.com/sharkdp/bat`
   - A GitHub deep link with branch and path: `https://github.com/sharkdp/bat/tree/master/src`
   - A GitLab URL (gitlab.com or self-hosted): `https://gitlab.com/gitlab-org/gitlab-shell`
   - A GitLab deep link: `https://gitlab.example.org/group/subgroup/project/-/tree/main/src`
3. The repo opens as a new workspace folder. Browse it like any local project — click a file to open it with full syntax highlighting.

Editing, saving, renaming, and deleting are disabled; the workspace is strictly read-only.

## Features

- **No cloning** — the file tree is fetched once via the GitHub/GitLab API and cached in memory; file contents are fetched lazily per-file as you open them.
- **GitHub and GitLab** — including self-hosted GitLab instances at any domain, and nested GitLab group/subgroup paths.
- **Multiple repos at once** — open several repos and they coexist as separate workspace folders.
- **GitHub sign-in on rate limit** — unauthenticated GitHub API calls are capped at 60/hour. If you hit that limit, Get Git offers to sign in through VS Code's built-in GitHub authentication (no separate OAuth app, no tokens to manage).

## Known Limitations

- Extremely large repositories (100,000+ files) may hit GitHub's tree API truncation limit; the truncated portion of the tree won't appear.
- Self-hosted GitLab instances are assumed to be mounted at the domain root (the common case) — an instance served from a subpath won't resolve correctly.
- The GitLab token setting is shared across all GitLab hosts; per-host tokens aren't supported.

## Requirements

None beyond VS Code itself — no external dependencies to install.

## Release Notes

### 0.0.1

Initial release: browse any public GitHub or GitLab repository (including self-hosted GitLab) as a read-only VS Code workspace, with GitHub sign-in on rate limit.
