import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { chromium, expect } from '@playwright/test'

const directory = resolve('dist/web'), output = resolve('output/playwright/web-ui')
await mkdir(output, { recursive: true })
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.wasm': 'application/wasm' }
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname, target = resolve(directory, path === '/' ? 'index.html' : '.' + path)
    if (!target.startsWith(directory + sep)) { response.writeHead(403).end(); return }
    response.setHeader('Content-Type', mime[extname(target)] ?? 'application/octet-stream'); response.end(await readFile(target))
  } catch { response.writeHead(404).end() }
})
await new Promise((ready, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', ready) })
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, acceptDownloads: true }), errors = [], requests = []
  page.on('pageerror', (error) => errors.push(error.message)); page.on('request', (request) => requests.push(request.url())); page.on('dialog', (dialog) => void dialog.accept())
  const base = `http://127.0.0.1:${server.address().port}`
  await page.goto(base); await page.getByRole('button', { name: 'Choose images', exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Choose folder', exact: true }).count(), 0)
  assert.equal(await page.getByRole('button', { name: 'Converter', exact: true }).getAttribute('aria-pressed'), 'true')
  const checkLayout = async () => assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal page overflow')
  await checkLayout(); await page.screenshot({ path: resolve(output, 'empty-375-light.png'), fullPage: true })
  await page.getByRole('button', { name: 'Open Settings' }).click()
  await expect(page.getByRole('button', { name: 'Close Settings' })).toBeFocused()
  await page.getByRole('button', { name: 'Dark', exact: true }).click(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'Open Settings' })).toBeFocused()
  await page.getByRole('button', { name: 'Optimizer', exact: true }).click(); await page.getByText('Strict optimization is unavailable in this browser build.', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Use Converter' }).click()
  const source = await readFile('test-fixtures/images/rgb.png'), invalid = await readFile('test-fixtures/images/unsupported.gif')
  await page.locator('input[type=file]').setInputFiles([{ name: '圖像-😃-' + 'long'.repeat(24) + '.png', mimeType: 'application/octet-stream', buffer: source }, { name: 'pretend.png', mimeType: 'image/png', buffer: invalid }])
  await page.locator('.queue-row [data-slot=badge]').filter({ hasText: 'Ready' }).waitFor()
  await page.locator('.queue-row [data-slot=badge]').filter({ hasText: 'Error' }).waitFor()
  await page.getByRole('checkbox', { name: 'Preserve metadata', exact: true }).uncheck()
  await page.getByRole('button', { name: 'PNG', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Resize images', exact: true }).check()
  await expect(page.locator('#resize-error')).toHaveText('Enter a width, height, or both.')
  await page.getByRole('spinbutton', { name: 'Width (px)' }).fill('32')
  await page.getByRole('button', { name: 'Process images', exact: true }).click()
  await page.locator('.result-row').waitFor({ timeout: 60000 })
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download', exact: true }).click(); const downloaded = await downloadPromise
  assert(downloaded.suggestedFilename().endsWith('.png')); assert.equal(await downloaded.failure(), null)
  await page.getByRole('checkbox', { name: 'Select all eligible results' }).check()
  await page.getByRole('button', { name: 'Prepare ZIP', exact: true }).click()
  await page.getByRole('button', { name: 'Download ZIP', exact: true }).waitFor()
  const archivePromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download ZIP', exact: true }).click(); assert.equal((await archivePromise).suggestedFilename(), 'remage-results.zip')
  for (const theme of ['light', 'dark']) {
    await page.getByRole('button', { name: 'Open Settings' }).click(); await page.getByRole('button', { name: theme === 'dark' ? 'Dark' : 'Light', exact: true }).click(); await page.keyboard.press('Escape')
    for (const width of [375, 768, 800, 1440]) { await page.setViewportSize({ width, height: width === 800 ? 600 : 900 }); await checkLayout(); await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: resolve(output, `results-${width}-${theme}.png`), fullPage: true }) }
    const palette = await page.evaluate(() => { const button = document.querySelector('.archive-actions [data-variant=default]'); return { rootScheme: getComputedStyle(document.documentElement).colorScheme, buttonScheme: getComputedStyle(button).colorScheme, buttonBackground: getComputedStyle(button).backgroundColor } })
    process.stdout.write(JSON.stringify({ theme, palette }) + '\n')
  }
  await page.getByRole('button', { name: 'Clear session', exact: true }).click()
  await page.getByRole('button', { name: 'Keep session', exact: true }).click(); assert.equal(await page.locator('.result-row').count(), 1)
  await page.getByRole('button', { name: 'Clear session', exact: true }).click(); await page.getByRole('alertdialog').getByRole('button', { name: 'Clear session', exact: true }).click()
  await page.getByText('Session cleared. Your original files were not modified.', { exact: true }).waitFor(); assert.equal(await page.locator('.result-row').count(), 0)
  const fonts = await page.evaluate(() => ({ ui: getComputedStyle(document.querySelector('h1')).fontFamily, data: getComputedStyle(document.querySelector('.data-text') ?? document.body).fontFamily }))
  assert(fonts.ui.includes('Atkinson Hyperlegible Next')); assert.equal(errors.length, 0); assert(requests.every((url) => url.startsWith(base) || url.startsWith('blob:')))
  process.stdout.write(JSON.stringify({ engine: 'chromium', version: browser.version(), actualApp: true, mixedIntake: true, processed: 1, downloads: 2, themes: 2, widths: [375, 768, 800, 1440], screenshots: output, errors }) + '\n')
} finally { await browser.close(); await new Promise((done) => server.close(done)) }
