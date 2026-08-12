// Shared helper used by every admin API route that needs to persist a
// change. Since this site has no database, "saving" means committing the
// updated file directly to your GitHub repo via GitHub's REST API — Vercel
// is already watching that repo, so a commit here triggers a normal
// redeploy automatically, the same as if you'd edited the file yourself
// and pushed.
//
// Required Vercel environment variables:
//   GITHUB_TOKEN   - a GitHub personal access token with write access to
//                    the repo's Contents (Fine-grained token: Contents =
//                    Read and write, scoped to this one repository, is
//                    enough and safer than a classic all-repos token.)
//   GITHUB_REPO    - "albertfoxsignal/tesserra"
//   GITHUB_BRANCH  - optional, defaults to "main"

async function githubRequest(path, options = {}) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) {
    throw new Error('Server not configured: set GITHUB_TOKEN and GITHUB_REPO in Vercel environment variables.');
  }
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub API ${res.status}: ${text.slice(0, 500)}`);
  }
  return res.json();
}

// Reads a file's current SHA (needed to update it) — returns null if the
// file doesn't exist yet (i.e. this will be a new file).
async function getFileSha(filePath, branch) {
  try {
    const data = await githubRequest(`/contents/${filePath}?ref=${branch}`);
    return data.sha;
  } catch (e) {
    if (String(e.message).includes('404')) return null;
    throw e;
  }
}

// Commits a file (create or update). `contentBase64` must already be
// base64-encoded (text files: Buffer.from(str).toString('base64');
// binary/image uploads: strip the data-URL prefix first).
async function commitFile(filePath, contentBase64, message) {
  const branch = process.env.GITHUB_BRANCH || 'main';
  const sha = await getFileSha(filePath, branch);
  return githubRequest(`/contents/${filePath}`, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      content: contentBase64,
      branch,
      ...(sha ? { sha } : {}),
    }),
  });
}

module.exports = { commitFile, getFileSha };
