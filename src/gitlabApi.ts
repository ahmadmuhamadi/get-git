import { TreeEntry, ensureParentDirs } from './treeEntry';

interface GitLabTreeItem {
	path: string;
	type: 'blob' | 'tree';
}

function headers(token?: string): Record<string, string> {
	return token ? { 'PRIVATE-TOKEN': token } : {};
}

export async function fetchDefaultBranch(host: string, projectPath: string, token?: string): Promise<string> {
	const url = `https://${host}/api/v4/projects/${encodeURIComponent(projectPath)}`;
	const response = await fetch(url, { headers: headers(token) });
	if (!response.ok) {
		throw new Error(`GitLab API request failed: ${response.status} ${response.statusText}`);
	}
	const data = await response.json() as { default_branch: string };
	return data.default_branch;
}

export async function fetchTree(host: string, projectPath: string, ref: string, token?: string): Promise<Map<string, TreeEntry>> {
	const entries = new Map<string, TreeEntry>();
	entries.set('', { type: 'dir', size: 0 });

	const encodedProject = encodeURIComponent(projectPath);
	let page: number | undefined = 1;

	while (page) {
		const url = `https://${host}/api/v4/projects/${encodedProject}/repository/tree?recursive=true&per_page=100&page=${page}&ref=${encodeURIComponent(ref)}`;
		const response = await fetch(url, { headers: headers(token) });
		if (!response.ok) {
			throw new Error(`GitLab API request failed: ${response.status} ${response.statusText}`);
		}

		const items = await response.json() as GitLabTreeItem[];
		for (const item of items) {
			if (item.type === 'tree') {
				entries.set(item.path, { type: 'dir', size: 0 });
			} else {
				entries.set(item.path, { type: 'file', size: 0 });
				ensureParentDirs(entries, item.path);
			}
		}

		const nextPage = response.headers.get('x-next-page');
		page = nextPage ? Number(nextPage) : undefined;
	}

	return entries;
}

export async function fetchFile(host: string, projectPath: string, ref: string, path: string, token?: string): Promise<Uint8Array> {
	const url = `https://${host}/${projectPath}/-/raw/${ref}/${path}`;
	const response = await fetch(url, { headers: headers(token) });
	if (!response.ok) {
		throw new Error(`GitLab raw file request failed: ${response.status} ${response.statusText}`);
	}
	return new Uint8Array(await response.arrayBuffer());
}
