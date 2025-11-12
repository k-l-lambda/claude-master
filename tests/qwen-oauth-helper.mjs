#!/usr/bin/env node

/**
 * Qwen OAuth Authentication Helper
 *
 * This script implements device flow OAuth authentication for Qwen API
 * Similar to how qwen code CLI handles OAuth login
 */

import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import qrcodeTerminal from 'qrcode-terminal';

// OAuth Configuration
const QWEN_OAUTH_BASE_URL = 'https://chat.qwen.ai';
const QWEN_OAUTH_DEVICE_CODE_ENDPOINT = `${QWEN_OAUTH_BASE_URL}/api/v1/oauth2/device/code`;
const QWEN_OAUTH_TOKEN_ENDPOINT = `${QWEN_OAUTH_BASE_URL}/api/v1/oauth2/token`;
const QWEN_OAUTH_CLIENT_ID = 'f0304373b74a44d2b584a3fb70ca9e56';
const QWEN_OAUTH_SCOPE = 'openid profile email model.completion';
const QWEN_OAUTH_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code';

// Token storage
const QWEN_DIR = path.join(os.homedir(), '.qwen');
const QWEN_CREDENTIAL_FILE = path.join(QWEN_DIR, 'oauth_creds.json');

// PKCE helpers
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier) {
  const hash = crypto.createHash('sha256');
  hash.update(verifier);
  return hash.digest('base64url');
}

function objectToUrlEncoded(data) {
  return Object.keys(data)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
    .join('&');
}

// Request device authorization
async function requestDeviceAuthorization(codeChallenge) {
  const bodyData = {
    client_id: QWEN_OAUTH_CLIENT_ID,
    scope: QWEN_OAUTH_SCOPE,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  };

  const response = await fetch(QWEN_OAUTH_DEVICE_CODE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'x-request-id': crypto.randomUUID(),
    },
    body: objectToUrlEncoded(bodyData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Device authorization failed: ${response.status} ${errorText}`);
  }

  return await response.json();
}

// Poll for device token
async function pollDeviceToken(deviceCode, codeVerifier) {
  const bodyData = {
    grant_type: QWEN_OAUTH_GRANT_TYPE,
    client_id: QWEN_OAUTH_CLIENT_ID,
    device_code: deviceCode,
    code_verifier: codeVerifier,
  };

  const response = await fetch(QWEN_OAUTH_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: objectToUrlEncoded(bodyData),
  });

  const result = await response.json();

  if (!response.ok) {
    return { error: result.error, error_description: result.error_description };
  }

  return result;
}

// Save credentials
async function saveCredentials(credentials) {
  await fs.mkdir(QWEN_DIR, { recursive: true });
  await fs.writeFile(QWEN_CREDENTIAL_FILE, JSON.stringify(credentials, null, 2), 'utf-8');
}

// Load credentials
async function loadCredentials() {
  try {
    const data = await fs.readFile(QWEN_CREDENTIAL_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

// Main OAuth flow
async function qwenOAuthLogin() {
  console.log('');
  console.log('━'.repeat(60));
  console.log('🔐 Qwen Chat OAuth Authentication');
  console.log('━'.repeat(60));
  console.log('');

  // Generate PKCE pair
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  console.log('📡 Requesting device authorization...');

  let deviceAuth;
  try {
    deviceAuth = await requestDeviceAuthorization(codeChallenge);
  } catch (error) {
    console.error('❌ Failed to request device authorization:', error.message);
    process.exit(1);
  }

  console.log('');
  console.log('✅ Authorization request successful!');
  console.log('');
  console.log('━'.repeat(60));
  console.log('📱 Please scan the QR code or visit the URL below:');
  console.log('━'.repeat(60));
  console.log('');

  // Display QR code
  console.log('QR Code:');
  console.log('');
  qrcodeTerminal.generate(deviceAuth.verification_uri_complete, { small: true }, (qrcode) => {
    console.log(qrcode);
  });

  console.log('');
  console.log('🔗 Or visit this URL:');
  console.log(`   ${deviceAuth.verification_uri_complete}`);
  console.log('');
  console.log(`⏱️  Code expires in: ${deviceAuth.expires_in} seconds`);
  console.log('');
  console.log('━'.repeat(60));
  console.log('');
  console.log('⏳ Waiting for authorization...');

  // Poll for token
  const startTime = Date.now();
  const expiresAt = startTime + (deviceAuth.expires_in * 1000);
  let dots = '';

  const interval = setInterval(() => {
    dots = dots.length >= 3 ? '' : dots + '.';
    process.stdout.write(`\r⏳ Waiting for authorization${dots}   `);
  }, 500);

  while (Date.now() < expiresAt) {
    const tokenResult = await pollDeviceToken(deviceAuth.device_code, codeVerifier);

    if (tokenResult.error) {
      if (tokenResult.error === 'authorization_pending') {
        // Still waiting for user to authorize
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before next poll
        continue;
      } else if (tokenResult.error === 'slow_down') {
        // Need to slow down polling
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        continue;
      } else if (tokenResult.error === 'expired_token') {
        clearInterval(interval);
        console.log('');
        console.log('');
        console.log('❌ Authorization code expired. Please try again.');
        process.exit(1);
      } else {
        clearInterval(interval);
        console.log('');
        console.log('');
        console.log(`❌ Authorization failed: ${tokenResult.error} - ${tokenResult.error_description}`);
        process.exit(1);
      }
    } else {
      // Success!
      clearInterval(interval);
      console.log('');
      console.log('');
      console.log('━'.repeat(60));
      console.log('✅ Authorization successful!');
      console.log('━'.repeat(60));
      console.log('');

      // Save credentials
      const credentials = {
        access_token: tokenResult.access_token,
        refresh_token: tokenResult.refresh_token,
        id_token: tokenResult.id_token,
        expiry_date: Date.now() + (tokenResult.expires_in * 1000),
        token_type: tokenResult.token_type,
        resource_url: tokenResult.resource_url,
      };

      await saveCredentials(credentials);
      console.log(`💾 Credentials saved to: ${QWEN_CREDENTIAL_FILE}`);
      console.log('');
      console.log('🎉 You can now use Qwen API with your account!');
      console.log('');
      console.log('Next steps:');
      console.log('  1. Your credentials are saved and will be used automatically');
      console.log('  2. Run your tests again');
      console.log('');

      return credentials;
    }
  }

  clearInterval(interval);
  console.log('');
  console.log('');
  console.log('❌ Authorization timed out. Please try again.');
  process.exit(1);
}

// Check if we already have valid credentials
async function checkExistingCredentials() {
  const creds = await loadCredentials();
  if (!creds || !creds.access_token) {
    return null;
  }

  // Check if token is expired
  if (creds.expiry_date && Date.now() >= creds.expiry_date) {
    console.log('⚠️  Stored credentials are expired. Re-authenticating...');
    console.log('');
    return null;
  }

  return creds;
}

// Export functions for use in other scripts
export {
  qwenOAuthLogin,
  loadCredentials,
  checkExistingCredentials,
  QWEN_CREDENTIAL_FILE,
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const existing = await checkExistingCredentials();
  if (existing) {
    console.log('✅ Valid credentials already exist!');
    console.log('');
    console.log(`📁 Credential file: ${QWEN_CREDENTIAL_FILE}`);
    console.log(`🔑 Access token: ${existing.access_token.substring(0, 20)}...`);
    console.log(`⏰ Expires: ${new Date(existing.expiry_date).toLocaleString()}`);
    console.log('');
    console.log('💡 To re-authenticate, delete the credential file and run this script again.');
  } else {
    await qwenOAuthLogin();
  }
}
