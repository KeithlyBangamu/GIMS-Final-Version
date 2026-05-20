// One-time helper to obtain a Google OAuth refresh token for Drive backups.
//
// Usage:
//   1. In Google Cloud Console → APIs & Services → Credentials, create an
//      OAuth 2.0 Client ID of type "Web application".
//      Add http://localhost:5311/oauth2callback to "Authorized redirect URIs".
//   2. Copy the Client ID and Client Secret.
//   3. Run:
//        $env:GOOGLE_OAUTH_CLIENT_ID="..."
//        $env:GOOGLE_OAUTH_CLIENT_SECRET="..."
//        node src/scripts/getDriveRefreshToken.js
//   4. Your browser opens; sign in with the Google account that owns the
//      backup folder, click "Allow".
//   5. The script prints the refresh token. Copy it to your Render env vars
//      as GOOGLE_OAUTH_REFRESH_TOKEN.
//
// The refresh token does not expire as long as you keep the OAuth client and
// don't revoke access. Treat it like a password.

import http from 'http';
import { URL } from 'url';
import { google } from 'googleapis';
import { exec } from 'child_process';

const PORT = 5311;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;

const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('ERROR: set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET first.');
  console.error('PowerShell example:');
  console.error('  $env:GOOGLE_OAUTH_CLIENT_ID="xxxxx.apps.googleusercontent.com"');
  console.error('  $env:GOOGLE_OAUTH_CLIENT_SECRET="GOCSPX-xxxxxx"');
  console.error('  node src/scripts/getDriveRefreshToken.js');
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

const authUrl = oauth2.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/drive.file'],
});

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (url.pathname !== '/oauth2callback') {
      res.writeHead(404).end('Not found');
      return;
    }
    const code = url.searchParams.get('code');
    const err = url.searchParams.get('error');
    if (err) {
      res.writeHead(400, { 'Content-Type': 'text/plain' }).end(`OAuth error: ${err}`);
      console.error('OAuth error:', err);
      server.close();
      process.exit(1);
      return;
    }
    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/plain' }).end('Missing code');
      return;
    }
    const { tokens } = await oauth2.getToken(code);
    res.writeHead(200, { 'Content-Type': 'text/html' }).end(
      '<html><body style="font-family:sans-serif;padding:2rem;">' +
      '<h2>Done — you can close this tab.</h2>' +
      '<p>Refresh token printed in your terminal.</p>' +
      '</body></html>'
    );
    console.log('\n=== Refresh token (paste into GOOGLE_OAUTH_REFRESH_TOKEN) ===\n');
    console.log(tokens.refresh_token || '(no refresh_token returned — revoke previous access at https://myaccount.google.com/permissions and re-run)');
    console.log('\n=== Full token response (for debugging) ===');
    console.log(JSON.stringify(tokens, null, 2));
    server.close();
    setTimeout(() => process.exit(0), 200);
  } catch (e) {
    console.error('Token exchange failed:', e.message);
    res.writeHead(500).end('Token exchange failed: ' + e.message);
    server.close();
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log(`Listening on ${REDIRECT_URI}`);
  console.log('\nOpen this URL in your browser if it does not open automatically:\n');
  console.log(authUrl);
  console.log('');
  const opener =
    process.platform === 'win32' ? `start "" "${authUrl}"` :
    process.platform === 'darwin' ? `open "${authUrl}"` :
    `xdg-open "${authUrl}"`;
  exec(opener, () => {});
});
