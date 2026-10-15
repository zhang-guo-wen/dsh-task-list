// Lead browser verification of the new surfaces. Run after
// tests/build-browser-fixture.mjs:
//   $env:DSH_TASK_PLAYWRIGHT = '<absolute path to playwright-core/index.mjs>'
//   node tests/verify-relation-views.mjs
//
// It drives the real rendered page in Chromium: the canvas geometry, the edge
// kinds, the approving chip, the blocked card, the board counts, and the
// composer's relation pickers are asserted through actual clicks, not jsdom.
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
if (!process.env.DSH_TASK_PLAYWRIGHT) throw new Error('Set DSH_TASK_PLAYWRIGHT to the existing playwright-core/index.mjs')
const { chromium } = await import(pathToFileURL(process.env.DSH_TASK_PLAYWRIGHT).href)
const root = resolve(import.meta.dirname, '../.browser-test')
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.message) })
  await page.route('https://task-fixture.test/**', async route => {
    const name = route.request().url().endsWith('fixture.js') ? 'fixture.js' : 'index.html'
    await route.fulfill({ contentType: name.endsWith('.js') ? 'text/javascript' : 'text/html', body: await readFile(resolve(root, name)) })
  })
  await page.goto('https://task-fixture.test/index.html')
  await page.evaluate(() => window.fixture.seedRelations())
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  await page.getByRole('button', { name: '编辑: 审批子任务', exact: true }).waitFor()

  // --- The view switch -------------------------------------------------------
  const views = page.getByRole('group', { name: '展示方式' })
  assert.equal(await views.getByRole('button').count(), 3, 'three surfaces')
  assert.equal(await views.getByRole('button', { name: '列表' }).getAttribute('aria-pressed'), 'true')

  // --- The topology canvas ---------------------------------------------------
  await views.getByRole('button', { name: '拓扑图' }).click()
  const canvas = page.getByRole('region', { name: '任务拓扑' })
  await canvas.waitFor()
  assert.equal(await page.locator('path[data-edge="parent"]').count(), 1, 'one parent edge')
  assert.equal(await page.locator('path[data-edge="waitsOn"]').count(), 1, 'one wait edge')
  // Both edge kinds are drawn, and the wait edge is the dashed one.
  const strokes = await page.evaluate(() => ({
    parent: getComputedStyle(document.querySelector('path[data-edge="parent"]')).strokeDasharray,
    waits: getComputedStyle(document.querySelector('path[data-edge="waitsOn"]')).strokeDasharray,
  }))
  assert.ok(strokes.parent === 'none' || strokes.parent === '', `parent edge is solid, got ${strokes.parent}`)
  assert.notEqual(strokes.waits, 'none', 'wait edge is dashed')
  // The approving task renders its own chip, and the waiting card is marked blocked.
  const childCard = page.locator('[data-node-id="relation-child"]')
  await childCard.waitFor()
  assert.equal(await childCard.getAttribute('data-status'), 'approving')
  assert.equal(await childCard.getAttribute('data-blocked'), 'true')
  assert.equal(await childCard.locator('[data-status="approving"]').textContent(), '审批中')
  // The card carries the executing session and its bot.
  const parentCard = page.locator('[data-node-id="relation-parent"]')
  assert.ok((await parentCard.textContent()).includes('当前中文会话'), 'the session title is on the card')

  // Real geometry: cards are laid out in separate columns, never overlapping.
  const boxes = await page.evaluate(() => [...document.querySelectorAll('[data-node-id]')].map(node => {
    const box = node.getBoundingClientRect()
    return { id: node.getAttribute('data-node-id'), left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height }
  }))
  assert.equal(boxes.length, 3, 'three cards are placed')
  const child = boxes.find(box => box.id === 'relation-child')
  const parent = boxes.find(box => box.id === 'relation-parent')
  assert.ok(parent.right <= child.left + 0.5, `parent column (${parent.right}) sits left of the child column (${child.left})`)
  for (const box of boxes) assert.ok(box.width > 100 && box.height > 40, `${box.id} has a real card box`)
  await page.screenshot({ path: resolve(root, 'relations-canvas.png') })

  // The zoom controls change the surface transform, and reset restores it.
  const zoom = () => page.evaluate(() => document.querySelector('[data-testid="task-canvas-surface"]').getAttribute('data-zoom'))
  await canvas.getByRole('button', { name: '放大' }).click()
  assert.notEqual(await zoom(), '1.00', 'zoom in changes the scale')
  await canvas.getByRole('button', { name: '重置视图' }).click()
  assert.equal(await zoom(), '1.00', 'reset restores the scale')

  // Status filtering hides the other columns without dropping the page.
  await page.getByRole('group', { name: '状态' }).getByRole('button', { name: '审批中' }).click()
  assert.equal(await page.locator('[data-node-id]').count(), 1, 'only the approving card remains')
  await page.getByRole('group', { name: '状态' }).getByRole('button', { name: '全部' }).click()
  assert.equal(await page.locator('[data-node-id]').count(), 3, 'the filter clears')

  // --- The card board --------------------------------------------------------
  await views.getByRole('button', { name: '卡片' }).click()
  const board = page.getByRole('region', { name: '状态总览' })
  await board.waitFor()
  assert.equal(await board.locator('[data-count="approving"]').textContent(), '1审批中')
  assert.equal(await board.locator('[data-count="in_progress"]').textContent(), '1进行中')
  assert.equal(await board.locator('[data-total="blocked"]').textContent(), '被阻塞 1')
  const execution = page.getByRole('region', { name: '执行情况' })
  assert.ok((await execution.textContent()).includes('当前中文会话'), 'the session is listed under execution')
  assert.equal(await page.locator('[data-session-id]').count(), 1, 'one session row')
  await page.screenshot({ path: resolve(root, 'relations-board.png') })

  // --- The composer writes the relations back --------------------------------
  await views.getByRole('button', { name: '列表' }).click()
  await page.getByRole('button', { name: '编辑: 审批子任务', exact: true }).click()
  const relations = page.locator('[data-field="relations"]')
  const parentSelect = relations.getByRole('combobox').first()
  assert.equal(await parentSelect.inputValue(), 'relation-parent', 'the stored parent is selected')
  assert.equal(await relations.getByRole('button', { name: '移除依赖: 前置依赖' }).count(), 1, 'the stored dependency is a chip')
  await page.screenshot({ path: resolve(root, 'relations-composer.png') })
  await page.getByRole('button', { name: '取消', exact: true }).click()

  // --- Both themes -----------------------------------------------------------
  // The fixture carries the Host's light and dark token blocks, so switching the
  // attribute is the same switch the Host performs. Every drawn surface must stay
  // readable: no card, chip, or edge may end up the same colour as its backing.
  await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''))
  await views.getByRole('button', { name: '拓扑图' }).click()
  await canvas.waitFor()
  const contrast = await page.evaluate(() => {
    const luminance = value => {
      const [r, g, b] = value.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(channel => {
        const c = channel / 255
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const ratio = (a, b) => {
      const [high, low] = [luminance(a), luminance(b)].sort((left, right) => right - left)
      return (high + 0.05) / (low + 0.05)
    }
    const card = document.querySelector('[data-node-id="relation-child"]')
    const chip = card.querySelector('[data-status="approving"]')
    const edge = document.querySelector('path[data-edge="parent"]')
    return {
      body: getComputedStyle(document.body).backgroundColor,
      card: getComputedStyle(card).backgroundColor,
      chip: getComputedStyle(chip).backgroundColor,
      chipInk: getComputedStyle(chip).color,
      edge: getComputedStyle(edge).stroke,
      dash: getComputedStyle(edge).strokeDasharray,
    }
  })
  assert.notEqual(contrast.card, contrast.body, 'the card surface differs from the page in dark mode')
  assert.ok(contrast.edge !== 'none', 'the edge has a stroke in dark mode')
  assert.ok(contrast.chipInk !== contrast.chip, 'the approving chip keeps readable ink in dark mode')
  assert.equal(contrast.dash, 'none', 'the parent edge stays solid in dark mode')
  await page.screenshot({ path: resolve(root, 'relations-canvas-dark.png') })
  await page.evaluate(() => document.body.removeAttribute('data-ds-dark-theme'))

  assert.deepEqual(errors, [], 'no page errors')
  console.log('relation views verified: canvas edges, approving chip, blocked card, board counts, execution rows, composer pickers, dark theme')
} finally {
  await browser.close()
}
