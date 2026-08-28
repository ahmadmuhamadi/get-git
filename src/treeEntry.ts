export interface TreeEntry {
	type: 'file' | 'dir';
	size: number;
}

export function ensureParentDirs(entries: Map<string, TreeEntry>, path: string): void {
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
