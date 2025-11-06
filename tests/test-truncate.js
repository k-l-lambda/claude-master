import { Display } from '../dist/display.js';

// Test truncate function
const shortMessage = "This is a short message";
const longMessage = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Additional text to make it even longer...";

console.log('=== Short Message (No Truncation) ===');
console.log(Display.truncate(shortMessage));
console.log('\n=== Long Message (Truncated) ===');
console.log(Display.truncate(longMessage));
console.log('\n=== Custom Max Length (100) ===');
console.log(Display.truncate(longMessage, 100));
