export interface ParsedRepo {
	owner: string;
	repo: string;
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
		return { ok: true, value: { owner, repo: stripGitSuffix(repo) } };
	}

	let url: URL;
	try {
		url = new URL(input.includes('://') ? input : `https://${input}`);
	} catch {
		return { ok: false, error: `Could not parse "${rawInput}" as a repository. Use "owner/repo" or a full GitHub URL.` };
	}

	if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') {
		return { ok: false, error: `Unsupported host "${url.hostname}". Only github.com is supported right now.` };
	}

	const segments = url.pathname.split('/').filter(Boolean);
	if (segments.length < 2) {
		return { ok: false, error: 'GitHub URL must include an owner and a repository, e.g. github.com/owner/repo.' };
	}

	const owner = segments[0];
	const repo = stripGitSuffix(segments[1]);

	if (segments.length === 2) {
		return { ok: true, value: { owner, repo } };
	}

	const marker = segments[2];
	if (marker === 'tree' || marker === 'blob') {
		if (segments.length < 4) {
			return { ok: false, error: `Expected a branch name after "/${marker}/" in the URL.` };
		}
		const ref = segments[3];
		const subpath = segments.slice(4).join('/') || undefined;
		return { ok: true, value: { owner, repo, ref, subpath } };
	}

	return { ok: true, value: { owner, repo, subpath: segments.slice(2).join('/') } };
}

function stripGitSuffix(repo: string): string {
	return repo.endsWith('.git') ? repo.slice(0, -'.git'.length) : repo;
}
