#!/usr/bin/env node
import * as esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, rmSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'));

// External dependencies that should not be bundled
const external = Object.keys(pkg.dependencies || {});

console.log('🔨 Building with esbuild...\n');

// Clean dist directory
console.log('🧹 Cleaning dist directory...');
try {
  rmSync('dist', { recursive: true, force: true });
} catch (err) {
  // Directory doesn't exist, ignore
}

// Create dist directory
import { mkdirSync } from 'fs';
mkdirSync('dist', { recursive: true });

try {
  // Build the main CLI entry point
  await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'esm',
    outfile: 'dist/index.js',
    minify: true,
    sourcemap: false,
    external: external,
    // Don't add banner in esbuild, we'll add it manually to avoid duplication
    metafile: true,
    logLevel: 'info',
  });

  // Add shebang manually
  const { readFileSync, writeFileSync } = await import('fs');
  let content = readFileSync('dist/index.js', 'utf-8');

  // Remove any existing shebang first
  content = content.replace(/^#!.*\n/, '');

  // Add our shebang at the beginning
  content = '#!/usr/bin/env node\n' + content;

  writeFileSync('dist/index.js', content, 'utf-8');

  console.log('\n✅ Build completed successfully!');
  console.log('\n📦 Bundle info:');

  // Show file sizes
  const { execSync } = await import('child_process');
  const stats = execSync('ls -lh dist/index.js').toString();
  console.log(stats);

  // Make executable
  execSync('chmod +x dist/index.js');
  console.log('✅ Made dist/index.js executable');

  // Show total dist size
  const totalSize = execSync('du -sh dist').toString().trim();
  console.log(`\n📁 Total dist size: ${totalSize.split('\t')[0]}`);

} catch (error) {
  console.error('❌ Build failed:', error);
  process.exit(1);
}
