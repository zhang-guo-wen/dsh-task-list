// Lead verification inside a real Harness instance (isolated DSH_HOME, npm
// package @deepseek-ai/dsh@0.2.0-rc.1, this checkout installed as a plugin link).
//   $env:DSH_TASK_PLAYWRIGHT = '<playwright-core/index.mjs>'
//   $env:DSH_TASK_URL = 'http://127.0.0.1:<port>/?token=<token>'
//   node tests/verify-host-relations.mjs
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
if (!process.env.DSH_TASK_PLAYWRIGHT) throw new Error('Set DSH_TASK_PLAYWRIGHT to the existing playwright-core/index.mjs')
if (!process.env.DSH_TASK_URL) throw new Error('Set DSH_TASK_URL to the running instance URL with its token')
const { chromium } = await import(pathToFileURL(process.env.DSH_TASK_PLAYWRIGHT).href)
const out = resolve(import.meta.dirname, '../.browser-test')
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.message) })
  await page.goto(process.env.DSH_TASK_URL)
  await page.waitForLoadState('domcontentloaded')

  // A fresh Harness home boots behind its own preview notice, which mounts a
  // moment after the shell; dismissing it is part of reaching the page, not part
  // of what is under test. It can mount more than once during boot, so keep
  // dismissing until the shell is actually interactive.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const notice = page.getByRole('button', { name: '继续', exact: true })
    if (await notice.count() === 0) {
      if (await page.locator('[class*="_mask_"]').count() === 0) break
      await page.waitForTimeout(500)
      continue
    }
    await notice.first().click({ timeout: 10_000 }).catch(() => {})
    await page.waitForTimeout(500)
  }

  // The plugin's own sidebar entry opens the page through the Host's slot system.
  const nav = page.getByRole('button', { name: '任务列表' }).first()
  await nav.waitFor({ timeout: 60_000 })
  await nav.click()
  await page.getByRole('heading', { name: '任务列表' }).waitFor({ timeout: 60_000 })

  /** Create one task through the real composer, with the fields the case needs. */
  const compose = async ({ content, parent, dependsOn, status }) => {
    console.error('step: open composer')
    const add = page.getByRole('button', { name: '新建任务', exact: true })
    await add.click()
    // Scope every field to the composer: the conversation composer is on screen
    // behind it and shares labels such as the content editor.
    const dialog = page.locator('[role="dialog"]').filter({ has: page.getByRole('button', { name: '保存', exact: true }) }).first()
    await dialog.waitFor({ timeout: 30_000 })
    const editor = dialog.locator('[contenteditable="true"]').first()
    await editor.click()
    await editor.type(content)
    const relations = dialog.locator('[data-field="relations"]')
    await relations.waitFor()
    if (parent !== undefined) { console.error('step: pick parent'); await relations.getByRole('combobox').first().selectOption({ label: parent }) }
    if (dependsOn !== undefined) {
      console.error('step: pick dependency')
      const picker = relations.getByRole('combobox').nth(1)
      await picker.selectOption({ label: dependsOn })
    }
    if (status !== undefined) { console.error('step: pick status'); await dialog.getByLabel('状态').selectOption({ label: status }) }
    console.error('step: save')
    await dialog.getByRole('button', { name: '保存', exact: true }).click()
    await page.getByRole('button', { name: `编辑: ${content}`, exact: true }).waitFor({ timeout: 30_000 })
    console.error('step: created', content)
  }

  await compose({ content: '联调：前置依赖' })
  await compose({ content: '联调：父任务', status: '进行中' })
  await compose({ content: '联调：子任务', parent: '联调：父任务', dependsOn: '联调：前置依赖', status: '审批中' })

  // The approving status reaches the host store, and its filter tab exists.
  const filters = page.getByRole('group', { name: '状态' })
  await filters.getByRole('button', { name: '审批中' }).click()
  await page.getByRole('button', { name: '编辑: 联调：子任务', exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: /^编辑: 联调/ }).count(), 1, 'the approving filter returns only the approving task')
  await filters.getByRole('button', { name: '全部' }).click()

  // The topology reads the relations from the real store through the new RPC.
  const views = page.getByRole('group', { name: '展示方式' })
  await views.getByRole('button', { name: '拓扑图' }).click()
  const canvas = page.getByRole('region', { name: '任务拓扑' })
  await canvas.waitFor({ timeout: 30_000 })
  assert.equal(await page.locator('path[data-edge="parent"]').count(), 1, 'one parent edge from the store')
  assert.equal(await page.locator('path[data-edge="waitsOn"]').count(), 1, 'one wait edge from the store')
  const childCard = page.locator('[data-node-id]').filter({ hasText: '联调：子任务' })
  await childCard.waitFor()
  assert.equal(await childCard.getAttribute('data-status'), 'approving')
  assert.equal(await childCard.getAttribute('data-blocked'), 'true')
  await page.screenshot({ path: resolve(out, 'host-canvas.png') })

  // The board counts come from the store overview.
  await views.getByRole('button', { name: '卡片' }).click()
  const board = page.getByRole('region', { name: '状态总览' })
  await board.waitFor({ timeout: 30_000 })
  assert.equal(await board.locator('[data-count="approving"]').textContent(), '1审批中')
  assert.equal(await board.locator('[data-total="total"]').textContent(), '任务总数 3')
  assert.equal(await board.locator('[data-total="blocked"]').textContent(), '被阻塞 1')
  await page.screenshot({ path: resolve(out, 'host-board.png') })

  await views.getByRole('button', { name: '列表' }).click()
  await page.getByRole('button', { name: '编辑: 联调：子任务', exact: true }).click()
  const relations = page.locator('[data-field="relations"]')
  assert.equal(await relations.getByRole('combobox').first().inputValue().then(value => value !== ''), true, 'the stored parent is selected')
  assert.equal(await relations.getByRole('button', { name: '移除依赖: 联调：前置依赖' }).count(), 1, 'the stored dependency round-trips')
  await page.screenshot({ path: resolve(out, 'host-composer.png') })

  assert.deepEqual(errors, [], 'no page errors')
  console.log('host instance verified: sidebar entry, composer relations, approving filter, canvas edges, board counts')
} catch (error) {
  // A failed run is diagnosed from the page itself: the screenshot and the
  // visible text say which surface the script was actually looking at.
  const pages = browser.contexts().flatMap(context => context.pages())
  const page = pages[0]
  if (page !== undefined) {
    await page.screenshot({ path: resolve(out, 'host-failure.png') }).catch(() => {})
    const text = await page.locator('body').innerText().catch(() => '')
    console.error('visible text:', text.slice(0, 500).replace(/\n+/g, ' | '))
  }
  throw error
} finally {
  await browser.close()
}
