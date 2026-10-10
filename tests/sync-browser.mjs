import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
const { chromium } = await import(pathToFileURL(process.env.DSH_TASK_PLAYWRIGHT).href)
const root = resolve(import.meta.dirname, '../.browser-test')
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('https://task-fixture.test/**', async route => {
    const name = route.request().url().endsWith('fixture.js') ? 'fixture.js' : 'index.html'
    await route.fulfill({ contentType: name.endsWith('.js') ? 'text/javascript' : 'text/html', body: await readFile(resolve(root, name)) })
  })
  await page.goto('https://task-fixture.test/index.html')

  // ── the list page: one split block, no standing sync copy ──────────────────
  const listPage = page.locator('#root')
  const create = listPage.getByRole('button', { name: '新建任务', exact: true })
  await create.waitFor()
  assert.equal(await listPage.getByRole('button', { name: '任务同步', exact: true }).count(), 0)
  assert.equal(await listPage.getByText(/同步所有已启用规则/).count(), 0)
  assert.equal(await listPage.getByText(/双方都改动时/).count(), 0)

  // An unconfigured Sync points at the settings page instead of starting a run.
  const handle = page.getByRole('button', { name: '更多操作', exact: true })
  await handle.click()
  const menuRow = page.getByRole('menuitem', { name: '同步', exact: true })
  await menuRow.waitFor()
  // The dropdown card covers the block exactly: its edges coincide with the
  // button above it, so it is never longer than that button.
  const block = await listPage.locator('[data-split="create-sync"]').boundingBox()
  const card = await page.getByRole('menu').boundingBox()
  assert.ok(block && card, 'split block and its menu must both be laid out')
  assert.ok(Math.abs(card.x - block.x) <= 1, `menu left ${card.x} must match block left ${block.x}`)
  assert.ok(Math.abs(card.x + card.width - (block.x + block.width)) <= 1,
    `menu right ${card.x + card.width} must match block right ${block.x + block.width}`)
  await page.screenshot({ path: resolve(root, 'task-list-header-menu-light.png') })
  await menuRow.click()
  // The prompt's node also holds its dismiss button, so match on its text run.
  await page.getByText(/还没有同步连接/).waitFor()
  await page.getByRole('button', { name: '知道了', exact: true }).click()
  assert.equal(await page.getByText(/还没有同步连接/).count(), 0)

  // The menu takes Escape and returns focus to its own handle.
  await handle.click()
  await menuRow.waitFor()
  await page.keyboard.press('Escape')
  await menuRow.waitFor({ state: 'hidden' })
  assert.equal(await handle.evaluate(element => element === document.activeElement), true)
  await page.screenshot({ path: resolve(root, 'task-list-header-light.png') })

  // ── the settings page: the same connection editor, inline ──────────────────
  const settings = page.locator('#settings-root')
  await settings.scrollIntoViewIfNeeded()
  const section = settings.getByRole('region', { name: '任务同步' })
  await section.getByRole('tab', { name: /连接/ }).waitFor()
  assert.equal(await section.getByRole('dialog').count(), 0)
  await section.getByRole('button', { name: '新增连接', exact: true }).click()
  // The editor is a bordered card with its own footer: no separate "back to list".
  assert.equal(await settings.getByRole('button', { name: '返回列表', exact: true }).count(), 0)
  await settings.getByRole('button', { name: '平台', exact: true }).click()
  await page.getByRole('menuitem', { name: 'TAPD', exact: true }).click()
  // A pasted workbench address is reduced to its company id.
  await settings.getByRole('textbox', { name: '公司 ID' }).fill('https://www.tapd.cn/2001/prong/stories')
  await settings.getByRole('textbox', { name: '个人访问令牌' }).fill('tapd-personal-token')
  await page.screenshot({ path: resolve(root, 'sync-connection-editor-light.png') })
  await settings.getByRole('button', { name: '保存连接', exact: true }).click()
  await settings.getByText('设置已保存，不会自动同步。', { exact: true }).waitFor()
  await settings.getByText('TAPD · 2001', { exact: true }).waitFor()
  // The rule editor draws the same field rhythm: label line, full-width control.
  await section.getByRole('tab', { name: /规则/ }).click()
  await settings.getByRole('button', { name: '新增规则', exact: true }).click()
  await settings.getByRole('button', { name: '连接与凭据', exact: true }).waitFor()
  assert.equal(await settings.getByRole('button', { name: '返回列表', exact: true }).count(), 0)
  await page.screenshot({ path: resolve(root, 'sync-rule-editor-light.png') })
  await settings.getByRole('button', { name: '取消', exact: true }).click()
  await section.getByRole('tab', { name: /连接/ }).click()
  await page.screenshot({ path: resolve(root, 'sync-settings-light.png') })

  // A connection without an enabled rule still refuses to start, now saying so.
  await page.locator('#root').scrollIntoViewIfNeeded()
  await handle.click()
  await menuRow.click()
  await page.getByText(/请在「设置 → 任务同步」中启用连接和规则/).waitFor()
  await page.getByRole('button', { name: '知道了', exact: true }).click()

  // ── dark and narrow ────────────────────────────────────────────────────────
  await page.evaluate(() => {
    const style = document.documentElement.style
    style.setProperty('--dsw-alias-label-primary', '#eee')
    style.setProperty('--dsw-alias-bg-base', '#181a20')
    style.setProperty('--dsw-alias-border-l3', '#45474d')
    style.setProperty('--dsw-alias-label-secondary', '#aaa')
  })
  await page.locator('#settings-root').scrollIntoViewIfNeeded()
  await page.screenshot({ path: resolve(root, 'sync-settings-dark.png') })
  await page.setViewportSize({ width: 390, height: 900 })
  await page.screenshot({ path: resolve(root, 'sync-settings-narrow.png') })
  assert.equal(await settings.evaluate(element => element.scrollWidth <= element.clientWidth + 1), true)
  await page.locator('#root').scrollIntoViewIfNeeded()
  assert.equal(await page.evaluate(() => document.body.scrollWidth <= window.innerWidth + 1), true)
  await page.screenshot({ path: resolve(root, 'task-list-narrow.png') })

  // ── the pre-existing task editor still works ───────────────────────────────
  await page.evaluate(() => window.fixture.addExternal())
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  await page.getByRole('button', { name: '编辑: 独立远端标题', exact: true }).click()
  await page.getByRole('textbox', { name: '外部任务标题', exact: true }).fill('保留独立标题')
  const editor = page.getByRole('textbox', { name: '内容（必填）' })
  assert.equal((await editor.innerText()).trim(), '')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  assert.equal(await page.evaluate(() => window.fixture.tasks()[0].title), '保留独立标题')
  assert.equal(await page.evaluate(() => window.fixture.tasks()[0].notes), '')
  assert.equal(await page.evaluate(() => document.querySelector('main').scrollWidth <= document.querySelector('main').clientWidth + 1), true)
  await page.screenshot({ path: resolve(root, 'sync-source-narrow.png') })
  assert.deepEqual(errors, [])
  console.log('Sync browser fixture passed: header split block/menu sync/no connection prompt/inline settings section/save/no rule prompt/menu Escape/return focus/light-dark/390px. No real Host or platform writes.')
} finally { await browser.close() }
