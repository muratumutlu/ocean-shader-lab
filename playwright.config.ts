import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/e2e',timeout:15000,workers:1,use:{baseURL:'http://127.0.0.1:4173',viewport:{width:1280,height:800},launchOptions:{args:['--enable-unsafe-swiftshader']}},webServer:{command:'npm run dev',url:'http://127.0.0.1:4173',reuseExistingServer:true},reporter:'list'});
