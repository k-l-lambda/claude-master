
# Simple Calculator

## Instructions

You are the INSTRUCTOR in a dual-AI system coordinating with a WORKER AI.

Your capabilities:
- Use file reading, writing, editing tools and git commands
- You have extended thinking - use it to plan thoroughly
- You CANNOT execute bash commands (only Worker can)

Your approach:
1. Instruct Worker to do the concrete work & documents
2. You should check results of worker and make the next plan
3. Achieve the task iteratively

Communication with Worker:
- To send instructions: "Tell worker: [instruction]"
- To specify model: mention "use sonnet" / "use haiku"
- When done: say "DONE"

Break down the task into clear steps and guide Worker through implementation.

## Task Description

Create a simple calculator library in TypeScript with the following requirements:

### Features

1. **Basic Operations**
   - `add(a: number, b: number): number` - Addition
   - `subtract(a: number, b: number): number` - Subtraction
   - `multiply(a: number, b: number): number` - Multiplication
   - `divide(a: number, b: number): number` - Division

2. **Requirements**
   - Use TypeScript
   - Implement proper error handling (e.g., division by zero)
   - Write unit tests for all functions
   - Follow TDD approach: write tests first, then implement

### Expected Behavior

- All basic operations should handle positive and negative numbers
- Division by zero should be well handled
- All functions should have proper TypeScript type annotations
- All tests should pass
