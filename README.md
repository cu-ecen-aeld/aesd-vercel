# AESD Repository Setup

This Next.js app lets students click an assignment link and automatically create a repository in the GitHub organization `cu-ecen-aeld` using the minimum necessary OAuth step for identity, then uses a GitHub App installation token for the org automation.

## Features

- 9 assignment links plus a final project link
- GitHub OAuth login to identify the student
- GitHub App installation token for repository creation and collaborator permissions
- Automatic admin permission assignment to the student
- Immediate redirect to the new repository page

## 1. Vercel project setup

Before setting up the GitHub auth and automation, create the Vercel app and project environment variables.

### Create the project in Vercel

1. Push this repo to GitHub.
2. Import the repo into Vercel.
3. In the Vercel project, open Project Settings > Environment Variables.
4. Add the environment variables listed below.
5. Deploy the project.

### Required environment variables

```bash
GITHUB_CLIENT_ID=your-github-oauth-app-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-app-client-secret
GITHUB_ORG=cu-ecen-aeld
GITHUB_APP_ID=123456
GITHUB_APP_INSTALLATION_ID=78901234
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nYOUR_PRIVATE_KEY_CONTENT\n-----END RSA PRIVATE KEY-----\n"
APP_URL=https://YOUR-APP.vercel.app
```

> The `GITHUB_APP_PRIVATE_KEY` value should contain literal newlines. In Vercel, the easiest approach is to paste the full PEM value exactly as provided by GitHub, with `\n` escaping only if needed by your environment. The app normalizes escaped newlines before signing JWTs.

## 2. GitHub setup

### 2.1 Create a GitHub OAuth App

Create a GitHub OAuth App for the student login step.

Set the callback URL to:

```text
https://YOUR-APP.vercel.app/api/oauth/callback
```

Record:
- `Client ID`
- `Client Secret`

### 2.2 Create a GitHub App for org automation

The automation only calls two GitHub API endpoints — `POST /orgs/{org}/repos` (create the repo) and `PUT /repos/{owner}/{repo}/collaborators/{username}` (add the student). Per GitHub's [permissions reference](https://docs.github.com/en/rest/authentication/permissions-required-for-github-apps), both endpoints fall under a single permission:

- **Repository permissions → Administration: Read & write**

Nothing else is needed (no organization-level permissions, no webhook events).

GitHub has no REST API for registering a brand-new App from nothing — creation always requires one authenticated browser action. The [manifest flow](https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest) keeps that to a single click and returns every credential (App ID, client ID/secret, webhook secret, and the private key PEM) from one `gh api` call, so the rest can be scripted:

**1. Write the manifest** (`APP_URL` is your deployed Vercel URL from the env vars above):

```bash
APP_URL=https://YOUR-APP.vercel.app

cat > /tmp/aesd-app-manifest.json <<EOF
{
  "name": "AESD Repo Setup",
  "url": "${APP_URL}",
  "redirect_url": "${APP_URL}/",
  "public": false,
  "default_permissions": { "administration": "write" },
  "default_events": []
}
EOF
```

**2. Submit it to GitHub for the `cu-ecen-aeld` org.** This step must be a POSTed browser form (there's no API for it), so generate a tiny self-submitting page and open it:

```bash
MANIFEST=$(cat /tmp/aesd-app-manifest.json)
cat > /tmp/aesd-app-submit.html <<EOF
<form id="f" action="https://github.com/organizations/cu-ecen-aeld/settings/apps/new" method="post">
  <input type="hidden" name="manifest" value='${MANIFEST}'>
</form>
<script>document.getElementById('f').submit()</script>
EOF
xdg-open /tmp/aesd-app-submit.html   # macOS: open ...  |  WSL: wslview ...
```

Click **Create GitHub App** on the confirmation page GitHub shows you (this is the one unavoidable manual click — GitHub requires owner consent). It then redirects to `${APP_URL}/?code=...`; copy the `code` value from the browser's address bar.

**3. Exchange the code for credentials** in one call:

```bash
CODE=paste-the-code-here
gh api -X POST /app-manifests/$CODE/conversions > github-app-credentials.json

echo "GITHUB_APP_ID=$(jq -r .id github-app-credentials.json)"
echo "GITHUB_APP_PRIVATE_KEY=\"$(jq -r '.pem | gsub("\n"; "\\n")' github-app-credentials.json)\""
```

Both lines print in the same `NAME=value` form used in the [env var table above](#required-environment-variables) — paste them straight into Vercel.

Treat `github-app-credentials.json` as a secret and delete it once the values are copied into Vercel.

**4. Install the app on the org.** Installation also requires a manual, authenticated click (GitHub doesn't expose an API for granting installation consent). The conversion response from step 3 already includes the app's page URL, so no extra API call (or app-level JWT auth) is needed:

```bash
jq -r .html_url github-app-credentials.json
```

Open the printed URL, click **Install**, pick the `cu-ecen-aeld` organization, and choose **All repositories** — this is required, since the app needs Administration access on repos that don't exist yet at install time. GitHub then redirects to a URL ending in `.../installations/<number>`; that number is `GITHUB_APP_INSTALLATION_ID`. You can find it again later under `cu-ecen-aeld` → Settings → GitHub Apps → Configure.

Record:
- `App ID`
- `Installation ID`
- `Private key`

### 2.3 Ensure the org is configured for repo creation

The target organization should allow the GitHub App installation to:
- create repositories
- add collaborators
- set visibility to `public`

## Local development

```bash
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Repository naming pattern

Each repository is created as:

```text
{assignment-slug}-{github_login}
```

Examples:

```text
assignment-1-jane-doe
assignment-2-jane-doe
final-project-jane-doe
```

The GitHub org repo path looks like:

```text
https://github.com/cu-ecen-aeld/assignment-1-jane-doe
```

## Flow summary

1. Student clicks assignment link.
2. App redirects to GitHub OAuth.
3. Student authorizes the app and the app reads their GitHub login.
4. App creates a GitHub App installation token.
5. App creates the org repository using the installation token.
6. App adds the student as an admin collaborator using the installation token.
7. App redirects the browser directly to the repository.

## Important notes

- The OAuth app is used only to get the student identity.
- The GitHub App installation token is used for the repo automation.
- The repository should generally be created with `visibility: "public"` to match the assignment workflow.
- The GitHub App private key and OAuth secret must be stored securely in Vercel environment variables.
- Do not commit real secrets to version control.

## Troubleshooting

### OAuth redirect mismatch

If the callback fails, verify that the GitHub OAuth app callback URL matches the deployed app URL exactly.

### Permission errors from the GitHub App

Check that the app is installed on the organization and that the installation has sufficient repository and collaborator permissions.

### Repository creation failed

Verify that the GitHub App private key, app ID, and installation ID are correct and that the org allows repository creation.

### Collaborator add failed

Make sure the student account is a valid GitHub user and that the app installation is allowed to manage collaborators in the org.
