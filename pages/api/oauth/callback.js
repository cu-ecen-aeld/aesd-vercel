const crypto = require('node:crypto');

function getAppPrivateKey() {
  return (process.env.GITHUB_APP_PRIVATE_KEY || '').replace(/\\n/g, '\n');
}

function createJwt(appId, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      iat: now - 60,
      exp: now + 600,
      iss: appId,
    })
  ).toString('base64url');

  const unsigned = `${header}.${payload}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = signer.sign({
    key: privateKey,
    padding: crypto.constants.RSA_PKCS1_PADDING,
  });

  return `${unsigned}.${signature.toString('base64url')}`;
}

async function getInstallationAccessToken() {
  const appId = process.env.GITHUB_APP_ID;
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
  const privateKey = getAppPrivateKey();

  if (!appId || !installationId || !privateKey) {
    throw new Error('Missing GitHub App configuration: GITHUB_APP_ID, GITHUB_APP_INSTALLATION_ID, and GITHUB_APP_PRIVATE_KEY are required');
  }

  const jwt = createJwt(appId, privateKey);
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub App token request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.token;
}

export default async function handler(req, res) {
  const { code, state } = req.query;

  if (!code || !state) {
    return res.status(400).send('Missing OAuth code or state');
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const org = process.env.GITHUB_ORG || 'cu-ecen-aeld';

  if (!clientId || !clientSecret) {
    return res.status(500).send('Missing GitHub OAuth environment variables');
  }

  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      throw new Error(tokenData.error_description || tokenData.error);
    }

    const oauthAccessToken = tokenData.access_token;

    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${oauthAccessToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!userResponse.ok) {
      throw new Error(`GitHub user lookup failed: ${userResponse.status}`);
    }

    const user = await userResponse.json();
    const githubId = user.login;
    const repoName = `${state}-${githubId}`;

    const appToken = await getInstallationAccessToken();

    const createRepoResponse = await fetch(`https://api.github.com/orgs/${org}/repos`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${appToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: repoName,
        visibility: 'public',
      }),
    });

    if (!createRepoResponse.ok) {
      const errorText = await createRepoResponse.text();
      let alreadyExists = false;
      try {
        const errorBody = JSON.parse(errorText);
        alreadyExists = createRepoResponse.status === 422 &&
          errorBody.errors?.some((e) => e.field === 'name');
      } catch {
        // not JSON, fall through to throw below
      }
      if (!alreadyExists) {
        throw new Error(`Create repo failed: ${createRepoResponse.status} ${errorText}`);
      }
    }

    const addCollaboratorResponse = await fetch(
      `https://api.github.com/repos/${org}/${repoName}/collaborators/${githubId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${appToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ permission: 'admin' }),
      }
    );

    if (!addCollaboratorResponse.ok) {
      const errorText = await addCollaboratorResponse.text();
      throw new Error(`Add collaborator failed: ${addCollaboratorResponse.status} ${errorText}`);
    }

    return res.redirect(`https://github.com/${org}/${repoName}`);
  } catch (error) {
    console.error('GitHub repo automation failed:', error);
    return res.redirect(`${appUrl}/error?message=${encodeURIComponent(error.message)}`);
  }
}
