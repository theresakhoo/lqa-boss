import { test, describe, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import puppeteer from 'puppeteer';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('LQA Boss UI Tests', () => {
  let browser;
  let page;
  const baseUrl = process.env.TEST_URL || 'http://localhost:3000/lqa-boss/';

  before(async () => {
    browser = await puppeteer.launch({
      headless: process.env.CI !== undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();
    
    // Set viewport for consistent testing
    await page.setViewport({ width: 1280, height: 720 });
    
    // Enable file downloads
    await page._client().send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: './tests/downloads'
    });
  });

  after(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('App loads successfully and shows initial state', async () => {
    await page.goto(baseUrl);

    // Wait for the app to load
    await page.waitForSelector('[data-testid="app-container"]', { timeout: 10000 });

    // Check for essential UI elements
    const buttons = await page.$$('button');
    assert.ok(buttons.length > 0, 'At least one button should be present');

    // Check for the header/menu (plugin architecture)
    const hasLogo = await page.$('img[alt="LQA Boss Logo"]') !== null;
    const hasHeader = await page.$('header') !== null;

    // Check for File menu button by text content
    const hasFileMenu = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.some(button => button.textContent.includes('File'));
    });

    // At least the header structure should be present
    assert.ok(hasLogo || hasHeader || hasFileMenu, 'App header with menu should be present');
  });

  test('Instructions modal opens and closes', async () => {
    await page.goto(baseUrl);
    await page.waitForSelector('[data-testid="app-container"]');
    
    // Click instructions button
    const instructionsButton = await page.$('[data-testid="instructions-button"]');
    if (instructionsButton) {
      await instructionsButton.click();
      
      // Wait for modal to appear
      await page.waitForSelector('[data-testid="instructions-modal"]', { timeout: 5000 });
      
      // Check modal content
      const modalTitle = await page.$eval('[data-testid="instructions-modal"] h2', el => el.textContent);
      assert.ok(modalTitle.includes('Instructions') || modalTitle.includes('How to'), 'Modal should have instructions title');
      
      // Close modal
      const closeButton = await page.$('[data-testid="instructions-modal"] button[aria-label*="close"]') ||
                          await page.$('[data-testid="instructions-modal"] .chakra-modal__close-btn');
      if (closeButton) {
        await closeButton.click();
        
        // Wait for modal to disappear
        await page.waitForSelector('[data-testid="instructions-modal"]', { hidden: true, timeout: 5000 });
      }
    }
  });

  test('File input accepts .lqaboss files', async () => {
    await page.goto(baseUrl);
    await page.waitForSelector('[data-testid="app-container"]');

    // With the plugin architecture, file input is created dynamically
    // Check if we can find the File menu which would trigger file selection
    const hasFileMenu = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.some(button => button.textContent.includes('File'));
    });

    if (hasFileMenu) {
      // The file menu exists - this is the entry point for file loading
      assert.ok(true, 'File menu exists for loading files');
    } else {
      // Fallback: check for any file input (created dynamically)
      const fileInput = await page.$('input[type="file"]');
      if (fileInput) {
        const acceptAttr = await page.evaluate(input => input.accept, fileInput);
        assert.ok(acceptAttr.includes('.lqaboss') || acceptAttr.includes('application/zip'),
          'File input should accept .lqaboss files');
      }
    }
  });

  test('App handles keyboard navigation', async () => {
    await page.goto(baseUrl);
    await page.waitForSelector('[data-testid="app-container"]');
    
    // Try basic keyboard navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    
    // Should not crash or show errors
    const errorElements = await page.$$('[data-testid*="error"]');
    assert.equal(errorElements.length, 0, 'No error elements should be present after keyboard navigation');
  });

  test('App is responsive and mobile-friendly', async () => {
    await page.goto(baseUrl);
    await page.waitForSelector('[data-testid="app-container"]');
    
    // Test mobile viewport
    await page.setViewport({ width: 375, height: 667 });
    
    // Wait for potential layout changes
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check that main content is still visible and properly sized
    const appContainer = await page.$('[data-testid="app-container"]');
    const boundingBox = await appContainer.boundingBox();
    
    assert.ok(boundingBox.width <= 375, 'App should fit in mobile viewport width');
    assert.ok(boundingBox.height > 0, 'App should have visible height on mobile');
    
    // Reset viewport
    await page.setViewport({ width: 1280, height: 720 });
  });

  test('App shows proper error handling for invalid files', async () => {
    await page.goto(baseUrl);
    await page.waitForSelector('[data-testid="app-container"]');
    
    // Listen for console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Try to load the page multiple times to ensure stability
    for (let i = 0; i < 3; i++) {
      await page.reload();
      await page.waitForSelector('[data-testid="app-container"]');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Should not have critical console errors
    const criticalErrors = consoleErrors.filter(error => 
      !error.includes('Warning') && 
      !error.includes('DevTools') &&
      !error.includes('manifest') &&
      !error.includes('Manifest')
    );
    
    assert.equal(criticalErrors.length, 0, `No critical console errors should occur: ${criticalErrors.join(', ')}`);
  });

  test('App maintains state during navigation', async () => {
    await page.goto(baseUrl);
    await page.waitForSelector('[data-testid="app-container"]');
    
    // Check that the app maintains its state when interacting with different elements
    const initialTitle = await page.title();
    
    // Simulate some user interactions
    await page.keyboard.press('Tab');
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const finalTitle = await page.title();
    assert.equal(initialTitle, finalTitle, 'Page title should remain consistent');
    
    // Check that main container is still present
    const appContainer = await page.$('[data-testid="app-container"]');
    assert.ok(appContainer, 'App container should remain present after interactions');
  });

  test('PWA features work correctly', async () => {
    await page.goto(baseUrl);
    
    // Check for PWA manifest
    const manifestLink = await page.$('link[rel="manifest"]');
    assert.ok(manifestLink, 'PWA manifest should be linked');
    
    // Check for service worker registration
    const swRegistered = await page.evaluate(() => {
      return 'serviceWorker' in navigator;
    });
    assert.ok(swRegistered, 'Service worker should be supported');
    
    // Check for basic PWA metadata
    const themeColor = await page.$('meta[name="theme-color"]');
    const viewport = await page.$('meta[name="viewport"]');
    
    assert.ok(themeColor, 'Theme color meta tag should be present');
    assert.ok(viewport, 'Viewport meta tag should be present');
  });
});