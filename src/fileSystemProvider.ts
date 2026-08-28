import * as vscode from 'vscode';
import { TreeEntry } from './treeEntry';
import { getHostAdapter } from './hosts';
import { GITHUB_HOST } from './parseRepoInput';

interface RepoState {
	host: string;
	projectPath: string;
	ref: string;
	tree: Map<string, TreeEntry>;
	blobCache: Map<string, Uint8Array>;
}

export class GetGitFileSystemProvider implements vscode.FileSystemProvider {
	private readonly onDidChangeFileEmitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
	readonly onDidChangeFile = this.onDidChangeFileEmitter.event;

	private readonly repos = new Map<string, RepoState>();

	mountRepo(host: string, projectPath: string, ref: string, tree: Map<string, TreeEntry>): void {
		this.repos.set(`${host}/${projectPath}`, { host, projectPath, ref, tree, blobCache: new Map() });
		this.onDidChangeFileEmitter.fire([{ type: vscode.FileChangeType.Changed, uri: vscode.Uri.parse('getgit:/') }]);
	}

	watch(): vscode.Disposable {
		return new vscode.Disposable(() => {});
	}

	stat(uri: vscode.Uri): vscode.FileStat {
		const { repoState, path } = this.resolve(uri);
		const entry = repoState.tree.get(path);
		if (!entry) {
			throw vscode.FileSystemError.FileNotFound(uri);
		}

		return {
			type: entry.type === 'dir' ? vscode.FileType.Directory : vscode.FileType.File,
			ctime: 0,
			mtime: 0,
			size: entry.size
		};
	}

	readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
		const { repoState, path } = this.resolve(uri);
		const entry = repoState.tree.get(path);
		if (!entry) {
			throw vscode.FileSystemError.FileNotFound(uri);
		}
		if (entry.type !== 'dir') {
			throw vscode.FileSystemError.FileNotADirectory(uri);
		}

		const prefix = path === '' ? '' : `${path}/`;
		const results: [string, vscode.FileType][] = [];

		for (const [entryPath, entryValue] of repoState.tree) {
			if (entryPath === '' || entryPath === path || !entryPath.startsWith(prefix)) {
				continue;
			}
			const rest = entryPath.slice(prefix.length);
			if (rest.includes('/')) {
				continue;
			}
			results.push([rest, entryValue.type === 'dir' ? vscode.FileType.Directory : vscode.FileType.File]);
		}

		return results;
	}

	async readFile(uri: vscode.Uri): Promise<Uint8Array> {
		const { repoState, path } = this.resolve(uri);
		const entry = repoState.tree.get(path);
		if (!entry) {
			throw vscode.FileSystemError.FileNotFound(uri);
		}
		if (entry.type !== 'file') {
			throw vscode.FileSystemError.FileIsADirectory(uri);
		}

		const cached = repoState.blobCache.get(path);
		if (cached) {
			return cached;
		}

		const token = repoState.host === GITHUB_HOST
			? undefined
			: vscode.workspace.getConfiguration('get-git').get<string>('gitlab.token');

		let bytes: Uint8Array;
		try {
			bytes = await getHostAdapter(repoState.host).fetchFile(repoState.projectPath, repoState.ref, path, token);
		} catch {
			throw vscode.FileSystemError.Unavailable(uri);
		}

		repoState.blobCache.set(path, bytes);
		return bytes;
	}

	writeFile(uri: vscode.Uri): void {
		throw vscode.FileSystemError.NoPermissions(uri);
	}

	rename(oldUri: vscode.Uri): void {
		throw vscode.FileSystemError.NoPermissions(oldUri);
	}

	delete(uri: vscode.Uri): void {
		throw vscode.FileSystemError.NoPermissions(uri);
	}

	createDirectory(uri: vscode.Uri): void {
		throw vscode.FileSystemError.NoPermissions(uri);
	}

	private resolve(uri: vscode.Uri): { repoState: RepoState; path: string } {
		const segments = uri.path.split('/').filter(Boolean);
		for (let len = segments.length; len >= 1; len--) {
			const key = `${uri.authority}/${segments.slice(0, len).join('/')}`;
			const repoState = this.repos.get(key);
			if (repoState) {
				return { repoState, path: segments.slice(len).join('/') };
			}
		}
		throw vscode.FileSystemError.FileNotFound(uri);
	}
}
