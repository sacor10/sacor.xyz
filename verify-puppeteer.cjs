const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const DOWNLOAD_DIR = path.resolve(process.env.USERPROFILE || 'C:/Users/sacor.xyz', 'Downloads');
const TARGET_VIDEO_URL = 'https://youtu.be/q4t-v_7TRIU?si=JhgV-9duEoT2BWJl';

(async () => {
  console.log('=== VERIFYING END-TO-END DOWNLOAD WITH PUPPETEER ===');
  console.log('Download directory:', DOWNLOAD_DIR);

  const initialFiles = new Set(fs.readdirSync(DOWNLOAD_DIR));

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: { width: 1280, height: 800 },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--allow-running-insecure-content',
    ]
  });

  const page = await browser.newPage();

  // Intercept auth-me request so Puppeteer runs as authenticated user without prompting Google OAuth
  await page.setRequestInterception(true);
  page.on('request', (interceptedReq) => {
    if (interceptedReq.url().includes('/.netlify/functions/auth-me')) {
      interceptedReq.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            email: 'sacor@sacor.xyz',
            picture: '',
            isOwner: true,
          },
        }),
      });
    } else {
      interceptedReq.continue();
    }
  });

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER PAGEERROR:', err.message));
  page.on('requestfailed', req => console.log('REQ FAILED:', req.url(), req.failure()?.errorText));
  page.on('response', res => {
    if (res.url().includes('5003') || res.url().includes('youtube')) {
      console.log('RES:', res.status(), res.url());
    }
  });

  const client = await page.target().createCDPSession();
  await client.send('Browser.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: DOWNLOAD_DIR,
    eventsEnabled: true,
  });

  console.log('Navigating to https://sacor.xyz/ytmp4 ...');
  await page.goto('https://sacor.xyz/ytmp4', { waitUntil: 'networkidle2', timeout: 30000 });

  console.log('Page loaded. Checking inputs...');
  await page.waitForSelector('input[type="url"]', { timeout: 10000 });

  console.log('Entering video URL:', TARGET_VIDEO_URL);
  await page.focus('input[type="url"]');
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await page.type('input[type="url"]', TARGET_VIDEO_URL);

  console.log('Clicking INSPECT VIDEO button...');
  const inspectBtn = await page.$('button[type="submit"]');
  await inspectBtn.click();

  console.log('Waiting for video inspection and quality dropdown...');
  try {
    await page.waitForSelector('select', { timeout: 15000 });
  } catch (err) {
    const errorMsg = await page.$eval('.igdl-status', el => el.textContent).catch(() => 'No status element found');
    console.error('Inspect failed! Status message on page:', errorMsg);
    throw err;
  }

  const qualities = await page.$$eval('select option', opts => opts.map(o => ({ value: o.value, text: o.textContent })));
  console.log('Available qualities found:', qualities.map(q => q.text));

  // Select 360p or 480p for fast verification download
  const selectVal = qualities.find(q => q.text.includes('360p'))?.value || qualities.find(q => q.text.includes('480p'))?.value || qualities[qualities.length - 1].value;
  console.log('Selecting quality value:', selectVal);
  await page.select('select', selectVal);

  console.log('Clicking Download button...');
  const downloadBtn = await page.waitForSelector('button.igdl-submit[type="button"]', { timeout: 10000 });
  await downloadBtn.click();

  console.log('Download initiated! Watching Downloads directory for file completion...');
  let downloadedFile = null;
  const startTime = Date.now();

  for (let i = 0; i < 180; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const currentFiles = fs.readdirSync(DOWNLOAD_DIR);
    const newFiles = currentFiles.filter(f => !initialFiles.has(f));

    const completedMp4 = newFiles.find(f => f.endsWith('.mp4') && !f.endsWith('.crdownload'));
    if (completedMp4) {
      const fullPath = path.join(DOWNLOAD_DIR, completedMp4);
      const stats = fs.statSync(fullPath);
      if (stats.size > 100000) {
        downloadedFile = { path: fullPath, size: stats.size };
        break;
      }
    } else {
      const downloading = newFiles.find(f => f.endsWith('.crdownload'));
      if (downloading) {
        process.stdout.write(`Downloading in progress: ${downloading} (${Math.round((Date.now() - startTime)/1000)}s)\r`);
      } else {
        process.stdout.write(`Waiting for download to trigger... (${Math.round((Date.now() - startTime)/1000)}s)\r`);
      }
    }
  }

  console.log('');
  if (downloadedFile) {
    console.log('>>> SUCCESS! File downloaded automatically to:', downloadedFile.path);
    console.log('>>> Size:', (downloadedFile.size / 1024 / 1024).toFixed(2), 'MB');
  } else {
    console.error('Download did not complete within the timeout period.');
  }

  await browser.close();
  process.exit(downloadedFile ? 0 : 1);
})();
