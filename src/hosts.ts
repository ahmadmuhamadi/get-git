import * as githubApi from './githubApi';
import * as gitlabApi from './gitlabApi';
import { TreeEntry } from './treeEntry';
import { GITHUB_HOST } from './parseRepoInput';

export interface HostAdapter {
	fetchTree(projectPath: string, ref: string, token?: string): Promise<Map<string, TreeEntry>>;
	fetchFile(projectPath: string, ref: string, path: string, token?: string): Promise<Uint8Array>;
}

function splitOwnerRepo(projectPath: string): [string, string] {
	const idx = projectPath.indexOf('/');
	return [projectPath.slice(0, idx), projectPath.slice(idx + 1)];
}

const githubAdapter: HostAdapter = {
	fetchTree: (projectPath, ref, token) => {
		const [owner, repo] = splitOwnerRepo(projectPath);
		return githubApi.fetchTree(owner, repo, ref, token);
	},
	fetchFile: (projectPath, ref, path) => {
		const [owner, repo] = splitOwnerRepo(projectPath);
		return githubApi.fetchFile(owner, repo, ref, path);
	}
};

function gitlabAdapter(host: string): HostAdapter {
	return {
		fetchTree: (projectPath, ref, token) => gitlabApi.fetchTree(host, projectPath, ref, token),
		fetchFile: (projectPath, ref, path, token) => gitlabApi.fetchFile(host, projectPath, ref, path, token)
	};
}

/** github.com gets the GitHub REST API; any other host is treated as a GitLab-compatible instance. */
export function getHostAdapter(host: string): HostAdapter {
	return host === GITHUB_HOST ? githubAdapter : gitlabAdapter(host);
}
