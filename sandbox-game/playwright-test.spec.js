import { test, expect } from '@playwright/test';

test('verify sandbox', async ({ page }) => {
  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`Error text: "${msg.text()}"`);
    }
  });

  page.on('pageerror', exception => {
    console.log(`Uncaught exception: "${exception}"`);
  });

  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(2000); // Give time for load and errors to show
});
