# Simple Calculator

A simple calculator implemented in TypeScript with basic arithmetic operations.

## Features

- Addition
- Subtraction
- Multiplication
- Division (with zero-division protection)
- Power/Exponentiation
- Square Root (with negative number protection)

## Installation

```bash
npm install
```

## Building

Compile TypeScript to JavaScript:

```bash
npm run build
```

This will compile the TypeScript files in `src/` to JavaScript in the `dist/` directory.

## Testing

Run the test suite:

```bash
npm test
```

## Usage

```typescript
import { Calculator } from 'simple-calculator';

const calc = new Calculator();

// Addition
console.log(calc.add(5, 3)); // 8

// Subtraction
console.log(calc.subtract(10, 4)); // 6

// Multiplication
console.log(calc.multiply(3, 7)); // 21

// Division
console.log(calc.divide(15, 3)); // 5

// Power
console.log(calc.power(2, 3)); // 8

// Square Root
console.log(calc.sqrt(16)); // 4
```

## Project Structure

```
simple-calculator/
├── src/
│   ├── calculator.ts       # Calculator implementation
│   ├── calculator.test.ts  # Test suite
│   └── index.ts           # Entry point
├── dist/                  # Compiled JavaScript (generated)
├── package.json           # Project configuration
├── tsconfig.json          # TypeScript configuration
├── jest.config.js         # Jest configuration
└── README.md             # This file
```

## API Documentation

### `Calculator`

#### `add(a: number, b: number): number`
Adds two numbers and returns the result.

#### `subtract(a: number, b: number): number`
Subtracts the second number from the first and returns the result.

#### `multiply(a: number, b: number): number`
Multiplies two numbers and returns the result.

#### `divide(a: number, b: number): number`
Divides the first number by the second and returns the result.
Throws an error if the divisor is zero.

#### `power(base: number, exponent: number): number`
Raises the base to the power of the exponent and returns the result.

#### `sqrt(n: number): number`
Calculates the square root of a number.
Throws an error if the number is negative.

## License

ISC
