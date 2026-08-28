import * as vscode from 'vscode';
import { fetchDefaultBranch, fetchTree, GitHubRateLimitError } from './githubApi';
import { GetGitFileSystemProvider } from './fileSystemProvider';
import { parseRepoInput } from './parseRepoInput';

const SCHEME = 'getgit';

export async function activate(context: vscode.ExtensionContext) {
	const provider = new GetGitFileSystemProvider();
	context.subscriptions.push(
		vscode.workspace.registerFileSystemProvider(SCHEME, provider, { isReadonly: true })
	);

	for (const folder of vscode.workspace.workspaceFolders ?? []) {
		const parsed = parseMountUri(folder.uri);
		if (!parsed) {
			continue;
		}
		const tree = await withGitHubAuth((token) => fetchTree(parsed.owner, parsed.repo, parsed.ref, token));
		provider.mountRepo(parsed.owner, parsed.repo, parsed.ref, tree);
	}

	context.subscriptions.push(
		vscode.commands.registerCommand('get-git.openRepo', () => openRepo(provider))
	);
}

async function openRepo(provider: GetGitFileSystemProvider) {
	const input = await vscode.window.showInputBox({
		prompt: 'Enter a GitHub repository',
		placeHolder: 'owner/repo or https://github.com/owner/repo/tree/branch/path'
	});
	if (input === undefined) {
		return;
	}

	const parsed = parseRepoInput(input);
	if (!parsed.ok) {
		vscode.window.showErrorMessage(parsed.error);
		return;
	}

	const { owner, repo, subpath } = parsed.value;
	const requestedRef = parsed.value.ref;

	try {
		const { ref, tree } = await withGitHubAuth(async (token) => {
			const resolvedRef = requestedRef ?? await fetchDefaultBranch(owner, repo, token);
			const resolvedTree = await fetchTree(owner, repo, resolvedRef, token);
			return { ref: resolvedRef, tree: resolvedTree };
		});
		provider.mountRepo(owner, repo, ref, tree);

		const repoUri = buildMountUri(owner, repo, ref);
		const folders = vscode.workspace.workspaceFolders ?? [];
		const existingIndex = folders.findIndex((folder) => {
			const existing = parseMountUri(folder.uri);
			return existing?.owner === owner && existing?.repo === repo;
		});

		if (existingIndex === -1) {
			vscode.workspace.updateWorkspaceFolders(folders.length, 0, { uri: repoUri, name: `${owner}/${repo}` });
		} else if (folders[existingIndex].uri.toString() !== repoUri.toString()) {
			vscode.workspace.updateWorkspaceFolders(existingIndex, 1, { uri: repoUri, name: `${owner}/${repo}` });
		}

		if (subpath) {
			await revealSubpath(repoUri, subpath);
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		vscode.window.showErrorMessage(`Could not open ${owner}/${repo}: ${message}`);
	}
}

async function withGitHubAuth<T>(work: (token?: string) => Promise<T>): Promise<T> {
	const existing = await vscode.authentication.getSession('github', ['repo'], { createIfNone: false });
	try {
		return await work(existing?.accessToken);
	} catch (error) {
		if (!(error instanceof GitHubRateLimitError)) {
			throw error;
		}

		const choice = await vscode.window.showWarningMessage(
			'GitHub API rate limit exceeded. Sign in to GitHub to increase your limit?',
			'Sign in'
		);
		if (choice !== 'Sign in') {
			throw error;
		}

		const session = await vscode.authentication.getSession('github', ['repo'], { createIfNone: true });
		return work(session.accessToken);
	}
}

function buildMountUri(owner: string, repo: string, ref: string): vscode.Uri {
	return vscode.Uri.parse(`${SCHEME}://github/${owner}/${repo}?ref=${encodeURIComponent(ref)}`);
}

function parseMountUri(uri: vscode.Uri): { owner: string; repo: string; ref: string } | undefined {
	if (uri.scheme !== SCHEME) {
		return undefined;
	}
	const segments = uri.path.split('/').filter(Boolean);
	const ref = new URLSearchParams(uri.query).get('ref');
	if (segments.length < 2 || !ref) {
		return undefined;
	}
	return { owner: segments[0], repo: segments[1], ref };
}

async function revealSubpath(repoUri: vscode.Uri, subpath: string): Promise<void> {
	const targetUri = vscode.Uri.joinPath(repoUri, subpath);
	try {
		const stat = await vscode.workspace.fs.stat(targetUri);
		if (stat.type === vscode.FileType.Directory) {
			await vscode.commands.executeCommand('revealInExplorer', targetUri);
		} else {
			await vscode.window.showTextDocument(targetUri);
		}
	} catch {
		// Subpath doesn't exist on this ref; leave the repo mounted without navigating.
	}
}

export function deactivate() {}
