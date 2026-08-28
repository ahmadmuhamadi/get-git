import { TreeEntry, ensureParentDirs } from './treeEntry';

export { TreeEntry };

interface GitHubTreeItem {
	path: string;
	type: 'blob' | 'tree' | 'commit';
	size?: number;
}

interface GitHubTreeResponse {
	tree: GitHubTreeItem[];
	truncated: boolean;
}

export class GitHubRateLimitError extends Error {
	constructor() {
		super('GitHub API rate limit exceeded.');
		this.name = 'GitHubRateLimitError';
	}
}

async function githubFetch(url: string, token?: string): Promise<Response> {
	const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}

	const response = await fetch(url, { headers });

	if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
		throw new GitHubRateLimitError();
	}
	if (!response.ok) {
		throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
	}

	return response;
}

export async function fetchDefaultBranch(owner: string, repo: string, token?: string): Promise<string> {
	const url = `https://api.github.com/repos/${owner}/${repo}`;
	const response = await githubFetch(url, token);
	const data = await response.json() as { default_branch: string };
	return data.default_branch;
}

export async function fetchTree(owner: string, repo: string, ref: string, token?: string): Promise<Map<string, TreeEntry>> {
	const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`;
	const response = await githubFetch(url, token);
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

export async function fetchFile(owner: string, repo: string, ref: string, path: string): Promise<Uint8Array> {
	const url = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`;
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`GitHub raw file request failed: ${response.status} ${response.statusText}`);
	}
	return new Uint8Array(await response.arrayBuffer());
}
