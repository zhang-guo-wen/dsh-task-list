// Renders the statistics report prototype and writes the review screenshots.
//   node prototype/check-statistics-calendar.mjs
import { chromium } from 'file:///C:/Users/Windows11/.dsh/profiles/desktop/node_modules/playwright-core/index.mjs'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
const root = resolve(import.meta.dirname)
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('file:///' + resolve(root, 'statistics-calendar.html').replaceAll('\\', '/'))

  const fitsOneScreen = async name => {
    const overflow = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
    assert.ok(overflow <= 0, `${name} must fit one screen without scrolling, overflows by ${overflow}px`)
    const clipped = await page.evaluate(() => [...document.querySelectorAll('.cell')]
      .filter(cell => cell.scrollHeight > cell.clientHeight + 1)
      .map(cell => cell.querySelector('.h b')?.textContent))
    assert.deepEqual(clipped, [], `${name} clips metric rows in: ${clipped.join(', ')}`)
  }
  const statCount = () => page.locator('[data-period="day"] .cell').first().locator('.stat').count()

  // Day view: 24 hours, six per row, two metrics per cell by default.
  await page.locator('[data-period="day"]').waitFor()
  assert.equal(await page.locator('[data-period="day"] .cell').count(), 24)
  assert.equal(await statCount(), 2)
  assert.equal(await page.locator('[data-period="day"] .cell[data-excluded]').count(), 8)
  assert.equal(await page.locator('.total').count(), 5)
  await fitsOneScreen('day view')
  await page.screenshot({ path: resolve(root, 'statistics-day.png') })

  // The metric cards are a read-only legend: pointing at one never changes a cell.
  const firstCell = page.locator('[data-period="day"] .cell').first()
  assert.equal(await page.locator('.total a, .total button').count(), 0, 'metric cards must not be interactive')
  const plainText = await firstCell.textContent()
  await page.locator('.total[data-metric="tasks"]').hover()
  assert.equal(await firstCell.textContent(), plainText, 'hovering a card must not change a cell')
  assert.equal(await statCount(), 2)

  // Hovering one cell explains that bucket with every metric.
  await firstCell.hover()
  const tip = page.locator('#tip:not([hidden])')
  await tip.waitFor()
  assert.equal(await tip.locator('.tip-group').count(), 2)
  assert.equal(await tip.locator('.tip-group em').count(), 5)
  assert.equal(await tip.locator('.tip-group em').first().textContent(), '新建会话')
  await page.screenshot({ path: resolve(root, 'statistics-day-tip.png') })
  await page.locator('.head h1').hover()
  await page.waitForFunction(() => document.querySelector('#tip').hidden)

  // Month view: weekday header plus the day cells aligned under it.
  await page.getByRole('button', { name: '月', exact: true }).click()
  await page.locator('[data-period="month"]').waitFor()
  assert.equal(await page.locator('.weekdays span').count(), 7)
  assert.equal(await page.locator('.weekdays span').first().textContent(), '周一')
  assert.equal(await page.locator('[data-period="month"] .cell').count(), 31)
  // 2026-10-01 is a Thursday, so three blanks precede day 1 under a Monday-first header.
  assert.equal(await page.locator('[data-period="month"] > .blank').count(), 3)
  await fitsOneScreen('month view')
  await page.screenshot({ path: resolve(root, 'statistics-month.png') })

  // A month that needs six weeks (Aug 2026 starts on a Saturday) must still fit.
  await page.locator('#date').fill('2026-08')
  await page.locator('[data-period="month"]').waitFor()
  assert.equal(await page.locator('[data-period="month"]').getAttribute('data-weeks'), '6')
  assert.equal(await page.locator('[data-period="month"] .cell').count(), 31)
  await fitsOneScreen('six-week month view')
  await page.locator('.total[data-metric="points"]').hover()
  await fitsOneScreen('six-week month with every card hovered metric')
  await page.screenshot({ path: resolve(root, 'statistics-month-6weeks.png') })
  await page.locator('#date').fill('2026-10')

  // Year view: twelve month cards named by month.
  await page.getByRole('button', { name: '年', exact: true }).click()
  await page.locator('[data-period="year"]').waitFor()
  assert.equal(await page.locator('[data-period="year"] .cell').count(), 12)
  assert.equal(await page.locator('[data-period="year"] .cell').first().locator('.h b').textContent(), '1月')
  const levels = await page.locator('[data-period="year"] .cell[data-level]').evaluateAll(cells => cells.map(cell => cell.dataset.level))
  assert.ok(new Set(levels).size > 1, 'the absolute scale must still separate months')
  await page.locator('.total[data-metric="sessions"]').hover()
  await fitsOneScreen('year view with a hovered metric')
  await page.screenshot({ path: resolve(root, 'statistics-year.png') })

  // Dark theme, then a narrow viewport.
  await page.getByRole('button', { name: '天', exact: true }).click()
  await page.locator('[data-period="day"]').waitFor()
  await page.getByRole('button', { name: '切换浅色与深色' }).click()
  await page.screenshot({ path: resolve(root, 'statistics-day-dark.png') })
  await page.getByRole('button', { name: '切换浅色与深色' }).click()
  await page.setViewportSize({ width: 430, height: 900 })
  await page.screenshot({ path: resolve(root, 'statistics-day-mobile.png') })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true)
  const clippedNarrow = await page.evaluate(() => [...document.querySelectorAll('.cell')]
    .filter(cell => cell.scrollHeight > cell.clientHeight + 1)
    .map(cell => cell.querySelector('.h b')?.textContent))
  assert.deepEqual(clippedNarrow, [], `narrow viewport clips metric rows in: ${clippedNarrow.join(', ')}`)
  assert.deepEqual(errors, [])
  console.log('Prototype passed: two metrics per cell, inert metric cards, cell hover card with all five metrics, day/month/year fit one screen, weekday header, month names, absolute heat scale, dark and 430px.')
} finally { await browser.close() }
