import * as assert from 'assert';
import * as vscode from 'vscode';
import { GetGitFileSystemProvider } from '../../fileSystemProvider';
import { TreeEntry } from '../../treeEntry';

function makeTree(entries: Record<string, TreeEntry>): Map<string, TreeEntry> {
	return new Map(Object.entries({ '': { type: 'dir', size: 0 } as TreeEntry, ...entries }));
}

suite('GetGitFileSystemProvider', () => {
	test('stat and readDirectory serve a mounted repo from the in-memory tree', () => {
		const provider = new GetGitFileSystemProvider();
		const tree = makeTree({
			src: { type: 'dir', size: 0 },
			'src/index.ts': { type: 'file', size: 42 },
			'README.md': { type: 'file', size: 10 }
		});
		provider.mountRepo('github.com', 'acme/widgets', 'main', tree);

		const root = vscode.Uri.parse('getgit://github.com/acme/widgets');
		const rootStat = provider.stat(root);
		assert.strictEqual(rootStat.type, vscode.FileType.Directory);

		const names = provider.readDirectory(root).map(([name]) => name).sort();
		assert.deepStrictEqual(names, ['README.md', 'src']);

		const fileStat = provider.stat(vscode.Uri.parse('getgit://github.com/acme/widgets/README.md'));
		assert.strictEqual(fileStat.type, vscode.FileType.File);
		assert.strictEqual(fileStat.size, 10);
	});

	test('readDirectory only lists immediate children, not deeper descendants', () => {
		const provider = new GetGitFileSystemProvider();
		const tree = makeTree({
			src: { type: 'dir', size: 0 },
			'src/a.ts': { type: 'file', size: 1 },
			'src/nested': { type: 'dir', size: 0 },
			'src/nested/b.ts': { type: 'file', size: 1 }
		});
		provider.mountRepo('github.com', 'acme/widgets', 'main', tree);

		const names = provider.readDirectory(vscode.Uri.parse('getgit://github.com/acme/widgets/src'))
			.map(([name]) => name)
			.sort();
		assert.deepStrictEqual(names, ['a.ts', 'nested']);
	});

	test('resolves nested GitLab group/subgroup paths via longest-prefix match', () => {
		const provider = new GetGitFileSystemProvider();
		const tree = makeTree({
			lib: { type: 'dir', size: 0 },
			'lib/main.rs': { type: 'file', size: 5 }
		});
		provider.mountRepo('gitlab.example.org', 'group/subgroup/project', 'main', tree);

		const fileUri = vscode.Uri.parse('getgit://gitlab.example.org/group/subgroup/project/lib/main.rs');
		const stat = provider.stat(fileUri);
		assert.strictEqual(stat.type, vscode.FileType.File);
		assert.strictEqual(stat.size, 5);
	});

	test('two repos with the same authority but different projects do not collide', () => {
		const provider = new GetGitFileSystemProvider();
		provider.mountRepo('github.com', 'acme/one', 'main', makeTree({ 'a.txt': { type: 'file', size: 1 } }));
		provider.mountRepo('github.com', 'acme/two', 'main', makeTree({ 'b.txt': { type: 'file', size: 2 } }));

		const oneListing = provider.readDirectory(vscode.Uri.parse('getgit://github.com/acme/one')).map(([n]) => n);
		const twoListing = provider.readDirectory(vscode.Uri.parse('getgit://github.com/acme/two')).map(([n]) => n);
		assert.deepStrictEqual(oneListing, ['a.txt']);
		assert.deepStrictEqual(twoListing, ['b.txt']);
	});

	test('an unmounted path is rejected with FileNotFound', () => {
		const provider = new GetGitFileSystemProvider();
		provider.mountRepo('github.com', 'acme/widgets', 'main', makeTree({}));
		assert.throws(
			() => provider.stat(vscode.Uri.parse('getgit://github.com/nobody/nothing')),
			(error: unknown) => error instanceof vscode.FileSystemError && error.code === 'FileNotFound'
		);
	});

	test('readDirectory on a file path throws FileNotADirectory', () => {
		const provider = new GetGitFileSystemProvider();
		provider.mountRepo('github.com', 'acme/widgets', 'main', makeTree({ 'file.txt': { type: 'file', size: 1 } }));
		assert.throws(
			() => provider.readDirectory(vscode.Uri.parse('getgit://github.com/acme/widgets/file.txt')),
			(error: unknown) => error instanceof vscode.FileSystemError && error.code === 'FileNotADirectory'
		);
	});

	test('write operations are always rejected since the provider is read-only', () => {
		const provider = new GetGitFileSystemProvider();
		provider.mountRepo('github.com', 'acme/widgets', 'main', makeTree({ 'file.txt': { type: 'file', size: 1 } }));
		const uri = vscode.Uri.parse('getgit://github.com/acme/widgets/file.txt');

		for (const call of [
			() => provider.writeFile(uri),
			() => provider.delete(uri),
			() => provider.createDirectory(uri),
			() => provider.rename(uri)
		]) {
			assert.throws(call, (error: unknown) => error instanceof vscode.FileSystemError && error.code === 'NoPermissions');
		}
	});

	test('readFile fetches through the host adapter once and serves subsequent reads from cache', async () => {
		const provider = new GetGitFileSystemProvider();
		provider.mountRepo('github.com', 'acme/widgets', 'main', makeTree({ 'hello.txt': { type: 'file', size: 5 } }));

		const originalFetch = globalThis.fetch;
		let callCount = 0;
		globalThis.fetch = (async () => {
			callCount++;
			return new Response('hello');
		}) as typeof fetch;

		try {
			const uri = vscode.Uri.parse('getgit://github.com/acme/widgets/hello.txt');
			const bytes = await provider.readFile(uri);
			assert.strictEqual(Buffer.from(bytes).toString('utf8'), 'hello');

			await provider.readFile(uri);
			assert.strictEqual(callCount, 1, 'second read should be served from the blob cache, not the network');
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test('readFile on a directory throws FileIsADirectory', async () => {
		const provider = new GetGitFileSystemProvider();
		provider.mountRepo('github.com', 'acme/widgets', 'main', makeTree({ src: { type: 'dir', size: 0 } }));
		await assert.rejects(
			() => provider.readFile(vscode.Uri.parse('getgit://github.com/acme/widgets/src')),
			(error: unknown) => error instanceof vscode.FileSystemError && error.code === 'FileIsADirectory'
		);
	});
});
