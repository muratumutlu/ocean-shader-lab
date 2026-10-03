import {copyFile} from 'node:fs/promises';
await copyFile('PROMPT.md','dist/PROMPT.md');
