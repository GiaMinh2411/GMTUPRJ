import { test, expect } from '@playwright/test';

for (const mobile of [false, true]) test(`font tiếng Việt ${mobile ? 'điện thoại' : 'máy tính'} dùng font Noto thực tế`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 720 }, isMobile: mobile, hasTouch: mobile });
  const page = await context.newPage(), failedFonts: string[] = [], loadedFonts: string[] = [];
  page.on('response', response => { if (response.url().includes('.woff2')) { if (response.status() >= 400) failedFonts.push(response.url()); else loadedFonts.push(response.url()); } });
  await page.addInitScript(() => localStorage.setItem('an-nhien-v1', JSON.stringify({ quality: 'low', name: 'An Nhiên', gender: 'male', onboardingCompleted: true })));
  await page.goto('/'); await page.evaluate(() => document.fonts.ready); await expect(page.getByRole('button', { name: 'Vào chùa', exact: true })).toBeEnabled();
  const cdp = await context.newCDPSession(page); await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const root = await cdp.send('DOM.getDocument');
  for (const selector of mobile ? ['.welcome h1', '.welcome h1 em'] : ['.welcome h1', '.welcome h1 em', '.scene-caption h2']) {
    const node = await cdp.send('DOM.querySelector', { nodeId: root.root.nodeId, selector });
    const result = await cdp.send('CSS.getPlatformFontsForNode', { nodeId: node.nodeId });
    const fonts = result.fonts.filter(font => font.glyphCount > 0);
    expect(fonts.length).toBeGreaterThan(0);
    expect(fonts.every(font => font.isCustomFont && font.familyName.replace(/\s/g, '').toLowerCase().includes('notoserif'))).toBe(true);
  }
  expect(failedFonts).toEqual([]); expect(loadedFonts.some(url => url.includes('vietnamese-wght-italic'))).toBe(true);
  expect(loadedFonts.every(url => new URL(url).origin === new URL(page.url()).origin)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/fonts-${mobile ? 'mobile' : 'desktop'}.png` });
  await page.locator('.welcome h1').screenshot({ path: `test-results/heading-${mobile ? 'mobile' : 'desktop'}.png` });
  if (!mobile) await page.locator('.scene-caption').screenshot({ path: 'test-results/caption-font.png' });
  await context.close();
});
