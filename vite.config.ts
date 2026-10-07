import { defineConfig } from 'vitest/config';
export default defineConfig({optimizeDeps:{entries:['index.html','tests/fixtures/*.html','tools/turtle-authoring.html']},server:{host:'127.0.0.1',port:4173,strictPort:true},build:{target:'es2022',rollupOptions:{input:{main:'index.html',game:'game.html'}}},test:{include:['tests/unit/**/*.test.ts']}});
