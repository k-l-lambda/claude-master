# Installation Guide

## Quick Install

### Method 1: Install from GitHub Packages (Recommended)

Install the published package from GitHub Packages:

```bash
# 1. Configure npm to use GitHub Packages for @k-l-lambda scope
echo "@k-l-lambda:registry=https://npm.pkg.github.com" >> ~/.npmrc

# 2. Authenticate with GitHub
# You need a GitHub Personal Access Token with 'read:packages' scope
# Create one at: https://github.com/settings/tokens/new?scopes=read:packages

# Login to GitHub Packages
npm login --scope=@k-l-lambda --registry=https://npm.pkg.github.com
# Enter your GitHub username
# Enter your Personal Access Token as password
# Enter your email

# 3. Install the package globally
npm install -g @k-l-lambda/claude-master

# 4. Verify installation
claude-master --version
claude-master --help
```

Now you can use `claude-master` from any directory!

### Method 2: Global Installation from Source

Install `claude-master` globally to use it from anywhere:

```bash
# Clone the repository
git clone https://github.com/yourusername/claude-master.git
cd claude-master

# Install dependencies
npm install

# Build the project
npm run build

# Install globally
npm link

# Verify installation
claude-master --version
claude-master --help
```

Now you can use `claude-master` from any directory!

### Uninstall

```bash
# If installed from GitHub Packages
npm uninstall -g @k-l-lambda/claude-master

# If installed from source with npm link
npm unlink -g claude-master
```

## Configuration

After installation, configure your API credentials:

### Option 1: Environment Variables (Recommended for global use)

Add to your shell profile (`~/.bashrc`, `~/.zshrc`, or equivalent):

```bash
export ANTHROPIC_AUTH_TOKEN="your-anthropic-api-key"
export ANTHROPIC_BASE_URL="https://api.anthropic.com"  # optional
```

Reload your shell:
```bash
source ~/.bashrc  # or ~/.zshrc
```

### Option 2: .env.local File (Per-project configuration)

In your project directory:

```bash
cd ~/my-project
echo "ANTHROPIC_AUTH_TOKEN=your-key" > .env.local
```

### Option 3: CLI Arguments (Ad-hoc usage)

```bash
claude-master "task" -k your-api-key -u https://api.anthropic.com
```

## Verification

Test your installation:

```bash
# Quick verification script (from project root)
./verify-installation.sh

# Or manually:
# Check version
claude-master --version

# View help
claude-master --help

# Run a simple test
claude-master "Create a hello world function in JavaScript"
```

## Local Development Setup

If you want to contribute or modify the code:

```bash
# Clone repository
git clone https://github.com/yourusername/claude-master.git
cd claude-master

# Install dependencies
npm install

# Run in development mode (auto-reload)
npm run dev "Your task"

# Build for production
npm run build

# Test the built version
npm start "Your task"
```

## Troubleshooting

### GitHub Packages Authentication Issues

If you get errors when installing from GitHub Packages:

**Error: 404 Not Found**
```bash
# Make sure you're authenticated
npm login --scope=@k-l-lambda --registry=https://npm.pkg.github.com

# Verify your .npmrc contains the correct registry
cat ~/.npmrc | grep @k-l-lambda
# Should show: @k-l-lambda:registry=https://npm.pkg.github.com
```

**Error: 401 Unauthorized**
```bash
# Your token may have expired or lacks the 'read:packages' scope
# Generate a new token at: https://github.com/settings/tokens/new?scopes=read:packages
# Then login again
npm login --scope=@k-l-lambda --registry=https://npm.pkg.github.com
```

**Error: Unable to authenticate**
```bash
# Check if you're using a Personal Access Token (classic)
# Not a fine-grained token - GitHub Packages requires classic tokens
# Create at: https://github.com/settings/tokens/new?scopes=read:packages
```

### Command Not Found

If `claude-master` is not found after installation:

1. Check npm global bin directory:
```bash
npm bin -g
# Should show a path like /usr/local/bin or ~/.nvm/versions/node/vXX.X.X/bin
```

2. Ensure this directory is in your PATH:
```bash
echo $PATH
# Should include the npm global bin directory
```

3. Try reinstalling:
```bash
npm unlink -g claude-master
npm run link
```

### Permission Denied

On Linux/Mac, if you get permission errors:

```bash
# Option 1: Use npm link (preferred)
npm run link

# Option 2: Install with sudo (not recommended)
sudo npm install -g .

# Option 3: Configure npm to use a different directory
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### Module Not Found

If you see module errors after installation:

```bash
# Rebuild
npm run build

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
npm run build
npm run link
```

### API Key Issues

If you get authentication errors:

```bash
# Verify your key is set
echo $ANTHROPIC_AUTH_TOKEN

# Test with explicit key
claude-master "test" -k your-key

# Check .env.local in your project
cat .env.local
```

## Updating

To update to the latest version:

**If installed from GitHub Packages:**
```bash
npm update -g @k-l-lambda/claude-master

# Or reinstall
npm uninstall -g @k-l-lambda/claude-master
npm install -g @k-l-lambda/claude-master
```

**If installed from source:**
```bash
cd claude-master
git pull
npm install
npm run build
npm run link
```

## Platform-Specific Notes

### Windows

On Windows:

**If using GitHub Packages:**
```bash
# Install
npm install -g @k-l-lambda/claude-master

# Uninstall
npm uninstall -g @k-l-lambda/claude-master
```

**If installing from source:**
```bash
# Install globally
npm install -g .

# Uninstall
npm uninstall -g claude-master
```

### macOS/Linux with NVM

If using NVM:
```bash
# npm link automatically uses the current node version
npm run link

# To use with a different node version
nvm use 18
npm run link
```

### Docker

To run in Docker:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

ENTRYPOINT ["node", "dist/index.js"]
CMD ["--help"]
```

Build and run:
```bash
docker build -t claude-master .
docker run -e ANTHROPIC_AUTH_TOKEN=your-key claude-master "Your task"
```

## Next Steps

After installation, check out:
- [README.md](../README.md) - Main documentation
- [Test Cases](../tests/cases/README.md) - Example projects to try
- [Communication Protocol](COMMUNICATION_PROTOCOL.md) - How Instructor and Worker communicate
