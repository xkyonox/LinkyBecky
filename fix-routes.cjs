const fs = require('fs');

// Read the content of the original file
const filePath = 'server/routes.ts';
const fileContent = fs.readFileSync(filePath, 'utf8');

// Count open and close parentheses
const openParenCount = (fileContent.match(/\(/g) || []).length;
const closeParenCount = (fileContent.match(/\)/g) || []).length;

console.log(`Open parentheses: ${openParenCount}`);
console.log(`Close parentheses: ${closeParenCount}`);

// Count open and close braces
const openBraceCount = (fileContent.match(/\{/g) || []).length;
const closeBraceCount = (fileContent.match(/\}/g) || []).length;

console.log(`Open braces: ${openBraceCount}`);
console.log(`Close braces: ${closeBraceCount}`);

// Generate fixed content by removing the extra parenthesis
// at line 1201 and adding proper closing syntax
const lines = fileContent.split('\n');

// Remove any added close brace or parenthesis at the end
if (lines[lines.length - 1] === ')' || lines[lines.length - 1] === '}') {
  lines.pop();
}

// Add the correct final line
const newContent = lines.join('\n');

// Write the fixed content to the output file
fs.writeFileSync('server/routes.ts.fixed', newContent + '\n  return httpServer;\n}', 'utf8');

console.log('Fixed file written to server/routes.ts.fixed');