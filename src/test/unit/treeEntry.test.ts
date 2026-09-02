import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ensureParentDirs, TreeEntry } from '../../treeEntry';

test('creates all missing intermediate directories for a nested path', () => {
	const entries = new Map<string, TreeEntry>();
	ensureParentDirs(entries, 'a/b/c/file.txt');
	assert.deepEqual([...entries.keys()].sort(), ['a', 'a/b', 'a/b/c']);
	for (const value of entries.values()) {
		assert.deepEqual(value, { type: 'dir', size: 0 });
	}
});

test('does not overwrite an entry that already exists at that path', () => {
	const entries = new Map<string, TreeEntry>();
	entries.set('a', { type: 'file', size: 99 });
	ensureParentDirs(entries, 'a/b/file.txt');
	assert.deepEqual(entries.get('a'), { type: 'file', size: 99 });
	assert.deepEqual(entries.get('a/b'), { type: 'dir', size: 0 });
});

test('a top-level file has no parent directory to create', () => {
	const entries = new Map<string, TreeEntry>();
	ensureParentDirs(entries, 'README.md');
	assert.equal(entries.size, 0);
});

test('is idempotent when called twice for the same path', () => {
	const entries = new Map<string, TreeEntry>();
	ensureParentDirs(entries, 'a/b/file.txt');
	ensureParentDirs(entries, 'a/b/other.txt');
	assert.deepEqual([...entries.keys()].sort(), ['a', 'a/b']);
});
