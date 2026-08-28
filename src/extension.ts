import * as vscode from 'vscode';
import * as githubApi from './githubApi';
import * as gitlabApi from './gitlabApi';
import { GitHubRateLimitError } from './githubApi';
import { TreeEntry } from './treeEntry';
import { GetGitFileSystemProvider } from './fileSystemProvider';
import { parseRepoInput, GITHUB_HOST } from './parseRepoInput';
import { getHostAdapter } from './hosts';

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
		const token = await getToken(parsed.host);
		const tree = await getHostAdapter(parsed.host).fetchTree(parsed.projectPath, parsed.ref, token);
		provider.mountRepo(parsed.host, parsed.projectPath, parsed.ref, tree);
	}

	context.subscriptions.push(
		vscode.commands.registerCommand('get-git.openRepo', () => openRepo(provider))
	);
}

async function openRepo(provider: GetGitFileSystemProvider) {
	const input = await vscode.window.showInputBox({
		prompt: 'Enter a GitHub or GitLab repository',
		placeHolder: 'owner/repo, a GitHub URL, or a GitLab URL (gitlab.com or self-hosted)'
	});
	if (input === undefined) {
		return;
	}

	const parsed = parseRepoInput(input);
	if (!parsed.ok) {
		vscode.window.showErrorMessage(parsed.error);
		return;
	}

	const { host, projectPath, subpath } = parsed.value;
	const requestedRef = parsed.value.ref;

	try {
		const { ref, tree } = await resolveRefAndTree(host, projectPath, requestedRef);
		provider.mountRepo(host, projectPath, ref, tree);

		const repoUri = buildMountUri(host, projectPath, ref);
		const folders = vscode.workspace.workspaceFolders ?? [];
		const existingIndex = folders.findIndex((folder) => {
			const existing = parseMountUri(folder.uri);
			return existing?.host === host && existing?.projectPath === projectPath;
		});

		if (existingIndex === -1) {
			vscode.workspace.updateWorkspaceFolders(folders.length, 0, { uri: repoUri, name: projectPath });
		} else if (folders[existingIndex].uri.toString() !== repoUri.toString()) {
			vscode.workspace.updateWorkspaceFolders(existingIndex, 1, { uri: repoUri, name: projectPath });
		}

		if (subpath) {
			await revealSubpath(repoUri, subpath);
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		vscode.window.showErrorMessage(`Could not open ${projectPath}: ${message}`);
	}
}

async function resolveRefAndTree(
	host: string,
	projectPath: string,
	requestedRef: string | undefined
): Promise<{ ref: string; tree: Map<string, TreeEntry> }> {
	if (host === GITHUB_HOST) {
		return withGitHubAuth(async (token) => {
			const [owner, repo] = splitOwnerRepo(projectPath);
			const ref = requestedRef ?? await githubApi.fetchDefaultBranch(owner, repo, token);
			const tree = await githubApi.fetchTree(owner, repo, ref, token);
			return { ref, tree };
		});
	}

	const token = getGitLabToken();
	const ref = requestedRef ?? await gitlabApi.fetchDefaultBranch(host, projectPath, token);
	const tree = await gitlabApi.fetchTree(host, projectPath, ref, token);
	return { ref, tree };
}

function splitOwnerRepo(projectPath: string): [string, string] {
	const idx = projectPath.indexOf('/');
	return [projectPath.slice(0, idx), projectPath.slice(idx + 1)];
}

function getGitLabToken(): string | undefined {
	return vscode.workspace.getConfiguration('get-git').get<string>('gitlab.token');
}

async function getToken(host: string): Promise<string | undefined> {
	if (host !== GITHUB_HOST) {
		return getGitLabToken();
	}
	const session = await vscode.authentication.getSession('github', ['repo'], { createIfNone: false });
	return session?.accessToken;
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

function buildMountUri(host: string, projectPath: string, ref: string): vscode.Uri {
	return vscode.Uri.parse(`${SCHEME}://${host}/${projectPath}?ref=${encodeURIComponent(ref)}`);
}

function parseMountUri(uri: vscode.Uri): { host: string; projectPath: string; ref: string } | undefined {
	if (uri.scheme !== SCHEME || !uri.authority) {
		return undefined;
	}
	const segments = uri.path.split('/').filter(Boolean);
	const ref = new URLSearchParams(uri.query).get('ref');
	if (segments.length < 2 || !ref) {
		return undefined;
	}
	return { host: uri.authority, projectPath: segments.join('/'), ref };
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
