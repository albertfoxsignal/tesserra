# TCF Admin CMS — Setup

The admin panel lives at **`/admin`** on the live site. Saving in the panel commits the change to this GitHub repo, and Vercel redeploys automatically (changes go live in ~1 minute).

Because this repository is **public**, no passwords or tokens are stored in any file here. Everything secret lives in Vercel environment variables. The CMS will not work until the four variables below are set.

## 1. Create a GitHub token (lets the CMS save changes)

1. GitHub → Settings → Developer settings → **Fine-grained personal access tokens** → Generate new token
2. Repository access: **Only select repositories** → `albertfoxsignal/tesserra`
3. Permissions → Repository permissions → **Contents: Read and write** (nothing else needed)
4. Generate, and copy the token (starts with `github_pat_...`)

## 2. Set Vercel environment variables

Vercel → `tesserra` project → Settings → **Environment Variables**. Add these four (Environment: Production):

| Name | Value |
|---|---|
| `ADMIN_PASSWORD` | The admin password you chose |
| `SESSION_SECRET` | Any long random string — e.g. run `openssl rand -hex 32`, or mash 40+ random characters |
| `GITHUB_TOKEN` | The token from step 1 |
| `GITHUB_REPO` | `albertfoxsignal/tesserra` |

(`GITHUB_BRANCH` is optional and defaults to `main`.)

## 3. Redeploy

Env vars only apply to new deployments: Vercel → Deployments → latest → ⋯ → **Redeploy**. Pushing this commit also counts.

## 4. Use it

- Open `https://your-domain/admin` → log in with the password
- Left sidebar: every page → its sections. Click a section to edit its text (EN + KO side by side) and images.
- **Adopt → Elder Cards** is a special editor: add/remove elders, edit their stories, upload photos, mark sponsored.
- **Custom Pages → + New Page**: paste or upload full HTML; it's published at `/pages/<slug>.html` and appears in the site nav automatically.
- Every save shows "live in about a minute" — that's the Vercel redeploy finishing. Refresh the live site after that.

## Notes & limits

- **Image uploads must be under ~3 MB** (serverless request limit). Resize large photos first — [squoosh.app](https://squoosh.app) is free and easy.
- The **Donate page** text is hardcoded in `index.html` (not in the translation system), so it isn't editable from the panel yet.
- Sessions last 8 hours, then you log in again.
- The password check happens server-side, so viewing the page source reveals nothing. Still, treat `/admin` as private — it's excluded from search engines (`noindex`) but anyone with the URL can see the login screen.
- If a save fails with a GitHub error, the token is usually expired or missing the Contents write permission — regenerate it and update `GITHUB_TOKEN`.
