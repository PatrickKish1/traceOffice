const FULL_SHA = /^[0-9a-f]{40}$/;

/** Entire rejects a short SHA. The commit page needs all 40 characters. */
export function entireCommitUrl(owner: string, repo: string, sha: string) {
  if (!FULL_SHA.test(sha)) return null;
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) return null;
  return `https://entire.io/gh/${owner}/${repo}/commit/${sha}`;
}
