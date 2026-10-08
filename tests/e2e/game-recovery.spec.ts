import {test,expect,type Page} from '@playwright/test';

// Regression: a scene restart (GPU context loss, retry) used to delete the controls the HUD had
// borrowed, so the restarted scene crashed reading #quality.
const loseContext=(page:Page)=>page.evaluate(()=>(document.querySelector('#ocean') as HTMLCanvasElement).getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext());
const ready=(page:Page)=>page.waitForFunction(()=>(window as unknown as {oceanFocus?:{scene?:unknown}}).oceanFocus?.scene,null,{timeout:20000});

test('game mode recovers from lost GPU contexts without losing its controls',async({page})=>{
 test.setTimeout(90_000);
 await page.goto('/game.html');await ready(page);
 await loseContext(page);
 await expect(page.locator('#fallback')).toBeHidden({timeout:5000});
 // A software-rendered CI GPU needs several seconds to rebuild the scene.
 await expect.poll(()=>page.evaluate(()=>document.querySelectorAll('.focus-corner').length),{timeout:15_000}).toBe(1);
 await expect(page.locator('.focus-settings #quality')).toHaveCount(1);
 // Repeated failures end on the retry card; retrying brings the full HUD back.
 for(let i=0;i<4;i++){await loseContext(page);await page.waitForTimeout(1500);}
 await expect(page.locator('#fallback')).toBeVisible();
 await expect(page.locator('#fallback-message')).toHaveText('Something interrupted the cove. Tap to bring it back.');
 await page.locator('#retry').click();
 await expect(page.locator('#fallback')).toBeHidden({timeout:15_000});
 await expect(page.locator('.focus-settings #settings-panel #quality')).toHaveCount(1);
 await expect(page.locator('.focus-controls')).toHaveCount(1);
});
