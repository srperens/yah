import { defineConfig } from 'vite';

// Relative base so the built assets work under GitHub Pages' project subpath
// (https://srperens.github.io/yah/) without hardcoding the repo name.
export default defineConfig({
  base: './',
});
