# Quick Install Guide - GitHub Packages

This is the **fastest way** to install `claude-master` if the package is published to GitHub Packages.

> **⚠️ Note**: GitHub Packages requires authentication even for public packages. This is a one-time setup per machine.
>
> **Alternative**: If you want authentication-free installation, the package can be published to [npmjs.com](https://www.npmjs.com) instead, allowing `npm install -g claude-master` without any GitHub login.

## Prerequisites

- Node.js >= 18.0.0
- npm (comes with Node.js)
- GitHub account with Personal Access Token

## Step 1: Create GitHub Personal Access Token

1. Visit: https://github.com/settings/tokens/new?scopes=read:packages
2. Select **Personal access tokens (classic)**
3. Check the **`read:packages`** scope
4. Click **Generate token**
5. Copy the token (you'll need it in the next step)

## Step 2: Configure npm for GitHub Packages

```bash
# Add GitHub Packages registry for @k-l-lambda scope
echo "@k-l-lambda:registry=https://npm.pkg.github.com" >> ~/.npmrc

# Login to GitHub Packages
npm login --scope=@k-l-lambda --registry=https://npm.pkg.github.com
```

When prompted:
- **Username**: Your GitHub username
- **Password**: Paste your Personal Access Token
- **Email**: Your GitHub email

## Step 3: Install

```bash
# Install globally
npm install -g @k-l-lambda/claude-master

# Verify installation
claude-master --version
```

## Step 4: Configure API Key

```bash
# Set your Anthropic API key
export ANTHROPIC_AUTH_TOKEN="your-anthropic-api-key"

# Or add to your shell profile (~/.bashrc or ~/.zshrc)
echo 'export ANTHROPIC_AUTH_TOKEN="your-anthropic-api-key"' >> ~/.bashrc
source ~/.bashrc
```

## Step 5: Test

```bash
# Show help
claude-master --help

# Run a test
cd /path/to/your/project
claude-master "Read README.md to understand the task"
```

## Done! 🎉

You can now use `claude-master` from any directory.

## Common Issues

### 404 Not Found
Make sure the package is published and you're authenticated:
```bash
npm login --scope=@k-l-lambda --registry=https://npm.pkg.github.com
```

### 401 Unauthorized
Your token may have expired. Generate a new one at:
https://github.com/settings/tokens/new?scopes=read:packages

### Token Type Error
GitHub Packages requires **Personal Access Token (classic)**, not fine-grained tokens.

## Updating

```bash
npm update -g @k-l-lambda/claude-master
```

## Uninstalling

```bash
npm uninstall -g @k-l-lambda/claude-master
```

## Next Steps

- Check out the [full documentation](../README.md)
- Try the [test cases](../tests/cases/README.md)
- Read about the [communication protocol](COMMUNICATION_PROTOCOL.md)
