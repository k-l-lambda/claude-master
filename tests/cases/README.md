# Test Cases for Instructor's Engineering Organization Ability

This directory contains test cases designed to evaluate the Instructor's ability to organize, plan, and coordinate software engineering projects of varying complexity.

## Test Cases Overview

### 1. Simple Calculator ✅ (Completed)
**Difficulty:** Beginner
**Focus:** Basic TDD workflow, simple project setup

**Key Evaluation Points:**
- Basic TypeScript project initialization
- Test-first development approach
- Simple code organization

---

### 2. Easy Todo List CLI
**Difficulty:** Easy
**Focus:** Basic project structure and modular design

**Path:** `tests/cases/easy-todo-list/`

**Key Evaluation Points:**
- Project structure organization (separating concerns)
- Module design (storage, CLI, business logic)
- Data persistence implementation
- Basic testing practices

**Estimated Rounds:** 5-10

---

### 3. API Client Library
**Difficulty:** Medium
**Focus:** Library architecture and advanced TypeScript usage

**Path:** `tests/cases/api-client-library/`

**Key Evaluation Points:**
- Library API design
- TypeScript generics and type safety
- Error handling strategy
- Interceptor pattern implementation
- Retry logic and resilience
- Comprehensive testing with mocks

**Estimated Rounds:** 10-15

---

### 4. Expense Tracker
**Difficulty:** Medium-Hard
**Focus:** Layered architecture and SOLID principles

**Path:** `tests/cases/expense-tracker/`

**Key Evaluation Points:**
- Layered architecture design (presentation, business, data)
- Database integration and migrations
- Dependency injection
- Validation strategy
- Business logic complexity
- Integration testing approach
- SOLID principles application

**Estimated Rounds:** 15-25

---

### 5. Blog CMS Backend
**Difficulty:** Hard
**Focus:** Production-ready system architecture

**Path:** `tests/cases/blog-cms-backend/`

**Key Evaluation Points:**
- Clean architecture implementation
- Domain-driven design concepts
- RESTful API design best practices
- Authentication and authorization
- Security considerations
- Database schema design
- Multiple entity relationships
- Comprehensive testing strategy
- API documentation
- Design patterns application
- Error handling hierarchy

**Estimated Rounds:** 25-40+

---

## Running Test Cases

To run a specific test case:

```bash
yarn dev "Read README.md to get aware your task." -d tests/cases/<test-name> --no-thinking
```

Examples:

```bash
# Easy
yarn dev "Read README.md to get aware your task." -d tests/cases/easy-todo-list --no-thinking

# Medium
yarn dev "Read README.md to get aware your task." -d tests/cases/api-client-library --no-thinking

# Medium-Hard
yarn dev "Read README.md to get aware your task." -d tests/cases/expense-tracker --no-thinking

# Hard
yarn dev "Read README.md to get aware your task." -d tests/cases/blog-cms-backend --no-thinking
```

## Evaluation Criteria

### 1. Project Planning & Organization
- Does Instructor break down the task into logical steps?
- Is the file structure well-organized?
- Are concerns properly separated?

### 2. Architecture Decisions
- Are appropriate design patterns applied?
- Is the architecture scalable and maintainable?
- Are layers/modules properly defined?

### 3. Code Quality
- Proper use of TypeScript types and interfaces
- Error handling strategy
- Code readability and maintainability

### 4. Testing Strategy
- Appropriate test coverage
- Unit vs integration test balance
- Mock usage and test isolation

### 5. Worker Coordination
- Clear instructions to Worker
- Proper task delegation
- Effective communication

### 6. Problem Solving
- Handling of edge cases
- Recovery from errors
- Adaptation to constraints

## Notes

- Use `--no-thinking` flag to reduce verbosity and focus on actions
- Each test case is self-contained in its own directory
- Instructor has file reading/writing and git tools
- Worker has file operations, bash commands, and web search
- Press ESC during execution to provide additional instructions

## Success Metrics

- ✅ All required features implemented
- ✅ Tests pass
- ✅ Clean code structure
- ✅ Proper error handling
- ✅ Documentation (where required)
- ✅ Instructor says "DONE" at completion
