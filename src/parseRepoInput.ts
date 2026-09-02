export const GITHUB_HOST = 'github.com';

export interface ParsedRepo {
	host: string;
	projectPath: string;
	ref?: string;
	subpath?: string;
}

export type ParseResult = { ok: true; value: ParsedRepo } | { ok: false; error: string };

const SHORTHAND = /^([\w.-]+)\/([\w.-]+)\/?$/;

export function parseRepoInput(rawInput: string): ParseResult {
	const input = rawInput.trim();
	if (input === '') {
		return { ok: false, error: 'Please enter a repository.' };
	}

	const shorthandMatch = SHORTHAND.exec(input);
	if (shorthandMatch) {
		const [, owner, repo] = shorthandMatch;
		return { ok: true, value: { host: GITHUB_HOST, projectPath: `${owner}/${stripGitSuffix(repo)}` } };
	}

	let url: URL;
	try {
		url = new URL(input.includes('://') ? input : `https://${input}`);
	} catch {
		return { ok: false, error: `Could not parse "${rawInput}" as a repository. Use "owner/repo" or a full GitHub/GitLab URL.` };
	}

	if (url.hostname === GITHUB_HOST || url.hostname === `www.${GITHUB_HOST}`) {
		return parseGitHubUrl(url);
	}

	return parseGitLabUrl(url);
}

function parseGitHubUrl(url: URL): ParseResult {
	const segments = url.pathname.split('/').filter(Boolean);
	if (segments.length < 2) {
		return { ok: false, error: 'GitHub URL must include an owner and a repository, e.g. github.com/owner/repo.' };
	}

	const owner = segments[0];
	const repo = stripGitSuffix(segments[1]);
	const projectPath = `${owner}/${repo}`;

	if (segments.length === 2) {
		return { ok: true, value: { host: GITHUB_HOST, projectPath } };
	}

	const marker = segments[2];
	if (marker === 'tree' || marker === 'blob') {
		if (segments.length < 4) {
			return { ok: false, error: `Expected a branch name after "/${marker}/" in the URL.` };
		}
		const ref = segments[3];
		const subpath = segments.slice(4).join('/') || undefined;
		return { ok: true, value: { host: GITHUB_HOST, projectPath, ref, subpath } };
	}

	return { ok: true, value: { host: GITHUB_HOST, projectPath, subpath: segments.slice(2).join('/') } };
}

function parseGitLabUrl(url: URL): ParseResult {
	const host = url.hostname;
	const segments = url.pathname.split('/').filter(Boolean);
	if (segments.length < 2) {
		return { ok: false, error: `GitLab URL must include a namespace and a project, e.g. ${host}/group/project.` };
	}

	const markerIndex = segments.indexOf('-');
	if (markerIndex === -1) {
		const projectPath = stripGitSuffix(segments.join('/'));
		return { ok: true, value: { host, projectPath } };
	}

	if (markerIndex < 2) {
		return { ok: false, error: 'GitLab URL must include a namespace and a project before "/-/".' };
	}

	const projectPath = stripGitSuffix(segments.slice(0, markerIndex).join('/'));
	const marker = segments[markerIndex + 1];
	if (marker !== 'tree' && marker !== 'blob') {
		return { ok: true, value: { host, projectPath } };
	}

	if (segments.length < markerIndex + 3) {
		return { ok: false, error: `Expected a branch name after "/-/${marker}/" in the URL.` };
	}

	const ref = segments[markerIndex + 2];
	const subpath = segments.slice(markerIndex + 3).join('/') || undefined;
	return { ok: true, value: { host, projectPath, ref, subpath } };
}

function stripGitSuffix(repo: string): string {
	return repo.endsWith('.git') ? repo.slice(0, -'.git'.length) : repo;
}
