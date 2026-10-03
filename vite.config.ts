import { defineConfig } from 'vitest/config';
export default defineConfig({server:{host:'127.0.0.1',port:4173,strictPort:true},build:{target:'es2022'},test:{include:['tests/unit/**/*.test.ts']}});
