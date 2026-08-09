export default async function handler(req, res) {
  const { assignment } = req.query;

  if (!assignment) {
    return res.status(400).send('Missing assignment parameter');
  }

  const org = process.env.GITHUB_ORG || 'cu-ecen-aeld';
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = `${process.env.APP_URL || 'http://localhost:3000'}/api/oauth/callback`;

  if (!clientId) {
    return res.status(500).send('Missing GITHUB_CLIENT_ID');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'read:user user:email',
    state: assignment,
    allow_signup: 'true',
  });

  return res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
}
