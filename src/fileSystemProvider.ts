import * as vscode from 'vscode';
import { TreeEntry } from './githubApi';

export class GetGitFileSystemProvider implements vscode.FileSystemProvider {
	private readonly onDidChangeFileEmitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
	readonly onDidChangeFile = this.onDidChangeFileEmitter.event;

	private tree = new Map<string, TreeEntry>();
	private rootPrefix = '';
	private owner = '';
	private repo = '';
	private ref = '';
	private readonly blobCache = new Map<string, Uint8Array>();

	setTree(tree: Map<string, TreeEntry>, owner: string, repo: string, ref: string): void {
		this.tree = tree;
		this.owner = owner;
		this.repo = repo;
		this.ref = ref;
		this.rootPrefix = `${owner}/${repo}`;
		this.blobCache.clear();
		this.onDidChangeFileEmitter.fire([{ type: vscode.FileChangeType.Changed, uri: vscode.Uri.parse('getgit:/') }]);
	}

	watch(): vscode.Disposable {
		return new vscode.Disposable(() => {});
	}

	stat(uri: vscode.Uri): vscode.FileStat {
		const path = this.normalizePath(uri.path);
		const entry = this.tree.get(path);
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
		const path = this.normalizePath(uri.path);
		const entry = this.tree.get(path);
		if (!entry) {
			throw vscode.FileSystemError.FileNotFound(uri);
		}
		if (entry.type !== 'dir') {
			throw vscode.FileSystemError.FileNotADirectory(uri);
		}

		const prefix = path === '' ? '' : `${path}/`;
		const results: [string, vscode.FileType][] = [];

		for (const [entryPath, entryValue] of this.tree) {
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

	readFile(): Uint8Array {
		throw new Error('Not implemented yet');
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

	private normalizePath(path: string): string {
		let normalized = path.replace(/^\/+/, '').replace(/\/+$/, '');
		if (this.rootPrefix !== '') {
			if (normalized === this.rootPrefix) {
				normalized = '';
			} else if (normalized.startsWith(`${this.rootPrefix}/`)) {
				normalized = normalized.slice(this.rootPrefix.length + 1);
			}
		}
		return normalized;
	}
}
