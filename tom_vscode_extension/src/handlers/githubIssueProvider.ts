/**
 * GitHub Issue Provider
 *
 * Implements the IssueProvider interface using GitHub's REST API
 * via the existing githubApi service layer.
 */

import {
    IssueProvider,
    IssueProviderRepo,
    IssueItem,
    IssueComment,
} from './issueProvider';

import {
    discoverWorkspaceRepos,
    listIssues as ghListIssues,
    getIssue as ghGetIssue,
    createIssue as ghCreateIssue,
    addComment as ghAddComment,
    listComments as ghListComments,
    updateIssue as ghUpdateIssue,
    GitHubIssue,
    GitHubComment,
} from './githubApi';

export class GitHubIssueProvider implements IssueProvider {
    readonly providerId = 'github';
    readonly displayName = 'GitHub';

    // ------------------------------------------------------------------
    // Repo discovery
    // ------------------------------------------------------------------

    discoverRepos(): IssueProviderRepo[] {
        return discoverWorkspaceRepos().map(r => ({
            id: r.displayName,       // "owner/repo"
            displayName: r.displayName,
        }));
    }

    // ------------------------------------------------------------------
    // CRUD
    // ------------------------------------------------------------------

    async listIssues(repoId: string, state: string): Promise<IssueItem[]> {
        const { owner, repo } = this._split(repoId);
        const ghState = (state === 'open' || state === 'closed') ? state : 'all';
        const issues = await ghListIssues(owner, repo, ghState as 'open' | 'closed' | 'all');
        // GitHub returns PRs in the issues endpoint — filter them out
        return issues
            .filter((i: any) => !i.pull_request)
            .map(i => this._mapIssue(i));
    }

    async getIssue(repoId: string, issueNumber: number): Promise<IssueItem> {
        const { owner, repo } = this._split(repoId);
        return this._mapIssue(await ghGetIssue(owner, repo, issueNumber));
    }

    async createIssue(repoId: string, title: string, body: string): Promise<IssueItem> {
        const { owner, repo } = this._split(repoId);
        return this._mapIssue(await ghCreateIssue(owner, repo, title, body));
    }

    async addComment(repoId: string, issueNumber: number, body: string): Promise<IssueComment> {
        const { owner, repo } = this._split(repoId);
        return this._mapComment(await ghAddComment(owner, repo, issueNumber, body));
    }

    async listComments(repoId: string, issueNumber: number): Promise<IssueComment[]> {
        const { owner, repo } = this._split(repoId);
        const comments = await ghListComments(owner, repo, issueNumber);
        return comments.map(c => this._mapComment(c));
    }

    // ------------------------------------------------------------------
    // Status management
    // ------------------------------------------------------------------

    async changeStatus(
        repoId: string,
        issueNumber: number,
        status: string,
        statusList: string[],
    ): Promise<IssueItem> {
        const { owner, repo } = this._split(repoId);

        // GitHub natively supports only open/closed.
        // Custom statuses (in_triage, assigned, etc.) are stored as labels.
        const ghState = (status === 'closed') ? 'closed' : 'open';
        const labelStatuses = statusList.filter(s => s !== 'open' && s !== 'closed');

        const currentIssue = await ghGetIssue(owner, repo, issueNumber);
        const currentLabels = (currentIssue.labels || []).map(l => l.name);

        const updates: { state: 'open' | 'closed'; labels?: string[] } = { state: ghState };

        if (labelStatuses.includes(status)) {
            // Add the status label, remove other status labels, keep open
            const filtered = currentLabels.filter(l => !labelStatuses.includes(l));
            filtered.push(status);
            updates.labels = filtered;
            updates.state = 'open';
        } else {
            // Plain open or closed — remove any status labels
            updates.labels = currentLabels.filter(l => !labelStatuses.includes(l));
        }

        return this._mapIssue(await ghUpdateIssue(owner, repo, issueNumber, updates));
    }

    // ------------------------------------------------------------------
    // Label management (key=value aware)
    // ------------------------------------------------------------------

    async toggleLabel(
        repoId: string,
        issueNumber: number,
        label: string,
    ): Promise<IssueItem> {
        const { owner, repo } = this._split(repoId);

        const currentIssue = await ghGetIssue(owner, repo, issueNumber);
        const currentLabels = (currentIssue.labels || []).map(l => l.name);

        let newLabels: string[];
        const eqIdx = label.indexOf('=');

        if (eqIdx > 0) {
            // key=value label: only one value per key
            const keyPrefix = label.substring(0, eqIdx + 1); // e.g. "quicklabel="
            const hasExact = currentLabels.includes(label);
            // Remove all labels sharing the same key…
            newLabels = currentLabels.filter(l => !l.startsWith(keyPrefix));
            // …and toggle: if it was already set, removing is enough
            if (!hasExact) {
                newLabels.push(label);
            }
        } else {
            // Simple label: plain toggle
            const hasLabel = currentLabels.includes(label);
            newLabels = hasLabel
                ? currentLabels.filter(l => l !== label)
                : [...currentLabels, label];
        }

        return this._mapIssue(
            await ghUpdateIssue(owner, repo, issueNumber, { labels: newLabels }),
        );
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private _split(repoId: string): { owner: string; repo: string } {
        const [owner, repo] = repoId.split('/');
        return { owner, repo };
    }

    private _mapIssue(i: GitHubIssue): IssueItem {
        return {
            id: String(i.id),
            number: i.number,
            title: i.title,
            body: i.body,
            state: i.state,
            labels: (i.labels || []).map(l => l.name),
            author: { name: i.user.login, avatarUrl: i.user.avatar_url },
            createdAt: i.created_at,
            updatedAt: i.updated_at,
            commentCount: i.comments,
            url: i.html_url,
        };
    }

    private _mapComment(c: GitHubComment): IssueComment {
        return {
            id: String(c.id),
            body: c.body,
            author: { name: c.user.login, avatarUrl: c.user.avatar_url },
            createdAt: c.created_at,
            updatedAt: c.updated_at,
            url: c.html_url,
        };
    }
}
