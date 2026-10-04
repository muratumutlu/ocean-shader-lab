import {defineConfig} from '@playwright/test';
const baseURL=process.env.COVE_TEST_URL??'http://127.0.0.1:4173';
export default defineConfig({testDir:'./tests/e2e',timeout:15000,workers:1,use:{baseURL,viewport:{width:1280,height:800},launchOptions:{args:process.env.COVE_GPU==='metal'?['--use-angle=metal']:['--enable-unsafe-swiftshader']}},webServer:process.env.COVE_TEST_URL?undefined:{command:'npm run dev',url:baseURL,reuseExistingServer:true},reporter:'list'});
