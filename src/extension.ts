import * as vscode from 'vscode';
import { fetchTree } from './githubApi';
import { GetGitFileSystemProvider } from './fileSystemProvider';

const SCHEME = 'getgit';

export async function activate(context: vscode.ExtensionContext) {
	const owner = 'sharkdp';
	const repo = 'bat';
	const ref = 'master';
	const repoUri = vscode.Uri.parse(`${SCHEME}://github/${owner}/${repo}`);

	const provider = new GetGitFileSystemProvider();
	context.subscriptions.push(
		vscode.workspace.registerFileSystemProvider(SCHEME, provider, { isReadonly: true })
	);

	const tree = await fetchTree(owner, repo, ref);
	provider.setTree(tree, `${owner}/${repo}`);

	const alreadyMounted = (vscode.workspace.workspaceFolders ?? []).some(
		(folder) => folder.uri.toString() === repoUri.toString()
	);
	if (!alreadyMounted) {
		vscode.workspace.updateWorkspaceFolders(0, 0, {
			uri: repoUri,
			name: `${owner}/${repo}`
		});
	}
}

export function deactivate() {}
