# Publishing Guide

This document explains how to publish `claude-master` to different npm registries.

## Option 1: Publish to GitHub Packages (Current Setup)

**Pros:**
- Integrated with GitHub repository
- Version control linked to releases

**Cons:**
- ⚠️ **Requires authentication even for public packages**
- Users must create GitHub Personal Access Token
- More complex installation process

### How to Publish

```bash
# Already configured in package.json
npm run build
npm publish
```

Users install with:
```bash
# Requires authentication
npm login --scope=@k-l-lambda --registry=https://npm.pkg.github.com
npm install -g @k-l-lambda/claude-master
```

---

## Option 2: Publish to npmjs.com (Recommended for Public Packages)

**Pros:**
- ✅ **No authentication required for installation**
- ✅ Faster installation
- ✅ Simpler for users
- ✅ Better discoverability

**Cons:**
- Requires npmjs.com account
- Package name must be available

### How to Switch

1. **Create npmjs.com account** (if you don't have one)
   - Visit: https://www.npmjs.com/signup

2. **Login to npm**
   ```bash
   npm login
   ```

3. **Update package.json**

   Remove or comment out the `publishConfig` section:
   ```json
   {
     "name": "claude-master",  // or "@yourusername/claude-master"
     // "publishConfig": {
     //   "registry": "https://npm.pkg.github.com"
     // },
   }
   ```

4. **Check if name is available**
   ```bash
   npm search claude-master
   # Or try your scoped name
   npm search @yourusername/claude-master
   ```

5. **Publish**
   ```bash
   npm run build
   npm publish
   # Or for scoped package
   npm publish --access public
   ```

### Users Install With (No Auth Required!)

```bash
# Simple installation - no login needed!
npm install -g claude-master

# Or if using scoped name
npm install -g @yourusername/claude-master
```

### Update README.md

After publishing to npmjs.com, update installation section:

```markdown
### Installation

```bash
# Install globally from npm
npm install -g claude-master

# Verify installation
claude-master --version
```

That's it! No authentication required.
```

---

## Option 3: Publish to Both

You can publish to both registries:

1. **Publish to npmjs.com first** (main distribution)
   ```bash
   # Temporarily remove publishConfig
   npm publish
   ```

2. **Then publish to GitHub Packages**
   ```bash
   # Restore publishConfig
   npm publish --registry=https://npm.pkg.github.com
   ```

Update documentation to recommend npmjs.com as primary method.

---

## Comparison Table

| Feature | GitHub Packages | npmjs.com |
|---------|----------------|-----------|
| Authentication Required | ✅ Yes (even for public) | ❌ No |
| Installation Complexity | High (token setup) | Low (one command) |
| User Experience | Complex | Simple |
| Discoverability | Low | High |
| Best For | Private packages | Public packages |

## Recommendation

**For public open-source projects like `claude-master`:**
- ✅ **Use npmjs.com** for easier adoption
- Users can install with just: `npm install -g claude-master`
- No authentication barriers
- Better for community adoption

**Keep GitHub Packages for:**
- Private/internal tools
- Enterprise projects
- When you need tight GitHub integration

---

## Current Status

The package is currently published to:
- ✅ GitHub Packages: `@k-l-lambda/claude-master`

To improve user experience, consider switching to npmjs.com.
