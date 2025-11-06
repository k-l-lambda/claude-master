#!/bin/bash

# Installation Verification Script for claude-master
# This script verifies that claude-master is properly installed and configured

set -e

echo "🔍 Verifying claude-master installation..."
echo ""

# Check if command exists
echo "1️⃣ Checking if claude-master command is available..."
if command -v claude-master &> /dev/null; then
    echo "   ✅ claude-master found at: $(which claude-master)"
else
    echo "   ❌ claude-master command not found"
    echo "   Please run: npm run link"
    exit 1
fi
echo ""

# Check version
echo "2️⃣ Checking version..."
version=$(claude-master --version 2>&1 | grep -E '^[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown")
echo "   ✅ Version: $version"
echo ""

# Check npm global bin in PATH
echo "3️⃣ Checking npm global bin directory..."
npm_bin=$(npm config get prefix 2>/dev/null)
if [ -n "$npm_bin" ]; then
    npm_bin_path="$npm_bin/bin"
    echo "   npm prefix: $npm_bin"
    echo "   npm global bin: $npm_bin_path"
    if echo "$PATH" | grep -q "$npm_bin_path"; then
        echo "   ✅ npm global bin is in PATH"
    else
        echo "   ⚠️  npm global bin is NOT in PATH"
        echo "   Add this to your ~/.bashrc or ~/.zshrc:"
        echo "   export PATH=\"$npm_bin_path:\$PATH\""
    fi
else
    echo "   ⚠️  Could not determine npm prefix"
fi
echo ""

# Check API key configuration
echo "4️⃣ Checking API key configuration..."
if [ -n "$ANTHROPIC_AUTH_TOKEN" ]; then
    echo "   ✅ ANTHROPIC_AUTH_TOKEN is set (environment variable)"
elif [ -f ".env.local" ]; then
    echo "   ✅ .env.local file found in current directory"
else
    echo "   ⚠️  No API key configured"
    echo "   Configure via:"
    echo "   - Environment: export ANTHROPIC_AUTH_TOKEN='your-key'"
    echo "   - Or create .env.local file with: ANTHROPIC_AUTH_TOKEN=your-key"
fi
echo ""

# Check test cases
echo "5️⃣ Checking test cases..."
if [ -d "tests/cases" ]; then
    test_count=$(ls -1 tests/cases | wc -l)
    echo "   ✅ Found $test_count test case directories"
    echo "   Available test cases:"
    ls -1 tests/cases | sed 's/^/      - /'
else
    echo "   ⚠️  Test cases directory not found"
    echo "   Run this script from the claude-master root directory"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Installation verification complete!"
echo ""
echo "📚 Next steps:"
echo "   1. Configure your API key (if not done yet)"
echo "   2. Try: claude-master --help"
echo "   3. Run a test case:"
echo "      claude-master \"Read README.md to understand your task\" \\"
echo "        -d tests/cases/simple-calculator --no-thinking"
echo ""
echo "📖 Documentation:"
echo "   - Installation: docs/INSTALLATION.md"
echo "   - Main README: README.md"
echo "   - Communication: docs/COMMUNICATION_PROTOCOL.md"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
