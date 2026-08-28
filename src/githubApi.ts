export interface TreeEntry {
	type: 'file' | 'dir';
	size: number;
}

interface GitHubTreeItem {
	path: string;
	type: 'blob' | 'tree' | 'commit';
	size?: number;
}

interface GitHubTreeResponse {
	tree: GitHubTreeItem[];
	truncated: boolean;
}

export async function fetchTree(owner: string, repo: string, ref: string): Promise<Map<string, TreeEntry>> {
	const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`;
	const response = await fetch(url, {
		headers: { Accept: 'application/vnd.github+json' }
	});

	if (!response.ok) {
		throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
	}

	const data = await response.json() as GitHubTreeResponse;
	const entries = new Map<string, TreeEntry>();
	entries.set('', { type: 'dir', size: 0 });

	for (const item of data.tree) {
		if (item.type === 'tree') {
			entries.set(item.path, { type: 'dir', size: 0 });
		} else if (item.type === 'blob') {
			entries.set(item.path, { type: 'file', size: item.size ?? 0 });
			ensureParentDirs(entries, item.path);
		}
	}

	return entries;
}

function ensureParentDirs(entries: Map<string, TreeEntry>, path: string): void {
	let parent = parentPath(path);
	while (parent !== '' && !entries.has(parent)) {
		entries.set(parent, { type: 'dir', size: 0 });
		parent = parentPath(parent);
	}
}

function parentPath(path: string): string {
	const idx = path.lastIndexOf('/');
	return idx === -1 ? '' : path.slice(0, idx);
}
