import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRepoInput, GITHUB_HOST } from '../../parseRepoInput';

test('shorthand owner/repo resolves to github.com', () => {
	const result = parseRepoInput('sharkdp/bat');
	assert.equal(result.ok, true);
	assert.ok(result.ok);
	assert.deepEqual(result.value, { host: GITHUB_HOST, projectPath: 'sharkdp/bat' });
});

test('full github url without ref', () => {
	const result = parseRepoInput('https://github.com/sharkdp/bat');
	assert.ok(result.ok);
	assert.equal(result.value.host, GITHUB_HOST);
	assert.equal(result.value.projectPath, 'sharkdp/bat');
	assert.equal(result.value.ref, undefined);
});

test('github tree deep link captures ref and subpath', () => {
	const result = parseRepoInput('https://github.com/sharkdp/bat/tree/master/src');
	assert.ok(result.ok);
	assert.equal(result.value.ref, 'master');
	assert.equal(result.value.subpath, 'src');
});

test('github blob deep link captures ref and file subpath', () => {
	const result = parseRepoInput('https://github.com/sharkdp/bat/blob/master/Cargo.toml');
	assert.ok(result.ok);
	assert.equal(result.value.ref, 'master');
	assert.equal(result.value.subpath, 'Cargo.toml');
});

test('.git suffix is stripped', () => {
	const result = parseRepoInput('https://github.com/sharkdp/bat.git');
	assert.ok(result.ok);
	assert.equal(result.value.projectPath, 'sharkdp/bat');
});

test('trailing slash is tolerated', () => {
	const result = parseRepoInput('https://github.com/sharkdp/bat/');
	assert.ok(result.ok);
	assert.equal(result.value.projectPath, 'sharkdp/bat');
});

test('protocol-less input is accepted', () => {
	const result = parseRepoInput('github.com/sharkdp/bat');
	assert.ok(result.ok);
	assert.equal(result.value.host, GITHUB_HOST);
});

test('gitlab.com url resolves with gitlab.com as host', () => {
	const result = parseRepoInput('https://gitlab.com/gitlab-org/gitlab-shell');
	assert.ok(result.ok);
	assert.equal(result.value.host, 'gitlab.com');
	assert.equal(result.value.projectPath, 'gitlab-org/gitlab-shell');
});

test('self-hosted gitlab domain is preserved as host', () => {
	const result = parseRepoInput('https://gitlab.example.org/group/project');
	assert.ok(result.ok);
	assert.equal(result.value.host, 'gitlab.example.org');
	assert.equal(result.value.projectPath, 'group/project');
});

test('gitlab "-/tree/" marker captures ref and subpath', () => {
	const result = parseRepoInput('https://gitlab.com/gitlab-org/gitlab-shell/-/tree/main/spec');
	assert.ok(result.ok);
	assert.equal(result.value.ref, 'main');
	assert.equal(result.value.subpath, 'spec');
});

test('gitlab "-/blob/" marker captures ref and file subpath', () => {
	const result = parseRepoInput('https://gitlab.com/gitlab-org/gitlab-shell/-/blob/main/README.md');
	assert.ok(result.ok);
	assert.equal(result.value.ref, 'main');
	assert.equal(result.value.subpath, 'README.md');
});

test('nested gitlab group/subgroup paths are preserved as one projectPath', () => {
	const result = parseRepoInput('https://gitlab.com/group/subgroup/project/-/blob/main/README.md');
	assert.ok(result.ok);
	assert.equal(result.value.projectPath, 'group/subgroup/project');
	assert.equal(result.value.ref, 'main');
	assert.equal(result.value.subpath, 'README.md');
});

test('empty input is rejected', () => {
	const result = parseRepoInput('   ');
	assert.equal(result.ok, false);
});

test('unparseable garbage is rejected with a clear error', () => {
	const result = parseRepoInput('not a repo at all');
	assert.equal(result.ok, false);
	assert.ok(!result.ok);
	assert.match(result.error, /Could not parse/);
});

test('github tree marker without a following ref segment is rejected', () => {
	const result = parseRepoInput('https://github.com/o/r/tree');
	assert.equal(result.ok, false);
});

test('gitlab "-/tree/" marker without a following ref segment is rejected', () => {
	const result = parseRepoInput('https://gitlab.com/gitlab-org/gitlab-shell/-/tree');
	assert.equal(result.ok, false);
});

test('github url missing a repo segment is rejected', () => {
	const result = parseRepoInput('https://github.com/onlyowner');
	assert.equal(result.ok, false);
});

test('gitlab url missing a project segment is rejected', () => {
	const result = parseRepoInput('https://gitlab.com/onlyone');
	assert.equal(result.ok, false);
});
