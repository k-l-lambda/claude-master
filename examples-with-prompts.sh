#!/bin/bash
# Example usage scenarios with different system prompts

source ./claude.local.sh

echo "════════════════════════════════════════════════════════════════"
echo "Example 1: Test-Driven Development Approach"
echo "════════════════════════════════════════════════════════════════"
echo ""

node dist/index.js "Create a simple string utility library with capitalize and reverse functions" \
  --system-prompt "You are a TDD expert. For every feature:
1. First instruct Worker to write comprehensive tests
2. Then implement the feature to pass the tests
3. Verify all tests pass before moving to the next feature
Always emphasize test coverage and code quality." \
  --max-rounds 8

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "Example 2: Security-First Development"
echo "════════════════════════════════════════════════════════════════"
echo ""

node dist/index.js "Create a user input validation module" \
  --system-prompt "You are a security engineer specializing in secure coding practices.
- Think about injection attacks, XSS, and other vulnerabilities
- Ensure proper input sanitization and validation
- Guide Worker to implement security best practices
- Review all code for potential security issues" \
  --max-rounds 10

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "Example 3: Documentation-First Approach"
echo "════════════════════════════════════════════════════════════════"
echo ""

node dist/index.js "Create a simple HTTP client wrapper" \
  --system-prompt "You are a documentation-driven developer.
For each component:
1. First create detailed documentation with examples
2. Then implement according to the documented API
3. Add comprehensive inline comments
4. Ensure the code matches the documentation
Focus on clarity and maintainability." \
  --max-rounds 8

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "Example 4: Minimal Supervision (Instructor Decides)"
echo "════════════════════════════════════════════════════════════════"
echo ""

node dist/index.js "Create a simple task queue system" \
  --system-prompt "You are an experienced software architect.
Use your best judgment to break down tasks and guide the Worker.
Focus on clean architecture, maintainability, and best practices." \
  --max-rounds 10

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "Example 5: Step-by-Step Learning Approach"
echo "════════════════════════════════════════════════════════════════"
echo ""

node dist/index.js "Create a simple Express.js REST API with CRUD operations" \
  --system-prompt "You are a patient teacher and experienced developer.
- Break down the task into very small, clear steps
- Explain the reasoning behind each decision
- Guide Worker through the implementation gradually
- Ensure Worker understands each component before moving forward
This is for learning, so prioritize clarity over speed." \
  --max-rounds 15

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "All examples completed!"
echo "════════════════════════════════════════════════════════════════"
