import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { withSqliteTransaction } from '../src/sqlite-transaction.ts'
import { TaskStore } from '../src/store.ts'

const roots: string[] = []
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-task-list-tx-'))
  roots.push(root)
  return join(root, 'tasks.sqlite')
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

function freshDb(): DatabaseSync {
  const db = new DatabaseSync(fixture())
  db.exec('CREATE TABLE t (id TEXT PRIMARY KEY, value TEXT) STRICT')
  return db
}

describe('withSqliteTransaction', () => {
  it('commits an outer transaction and returns its result', () => {
    const db = freshDb()
    const result = withSqliteTransaction(db, () => {
      db.prepare('INSERT INTO t (id, value) VALUES (?, ?)').run('a', 'x')
      return 'done'
    })
    expect(result).toBe('done')
    expect((db.prepare('SELECT value FROM t WHERE id = ?').get('a') as { value: string }).value).toBe('x')
    db.close()
  })

  it('rolls back an outer transaction on error', () => {
    const db = freshDb()
    expect(() => withSqliteTransaction(db, () => {
      db.prepare('INSERT INTO t (id, value) VALUES (?, ?)').run('a', 'x')
      throw new Error('boom')
    })).toThrow('boom')
    expect(db.prepare('SELECT * FROM t').all()).toHaveLength(0)
    db.close()
  })

  it('rolls back only the inner savepoint when a nested operation fails', () => {
    const db = freshDb()
    withSqliteTransaction(db, () => {
      db.prepare('INSERT INTO t (id, value) VALUES (?, ?)').run('outer', 'kept')
      expect(() => withSqliteTransaction(db, () => {
        db.prepare('INSERT INTO t (id, value) VALUES (?, ?)').run('inner', 'gone')
        throw new Error('inner boom')
      })).toThrow('inner boom')
    })
    expect((db.prepare('SELECT id FROM t ORDER BY id').all() as { id: string }[]).map(row => row.id)).toEqual(['outer'])
    db.close()
  })

  it('rolls back outer and inner changes together when the outer operation fails', () => {
    const db = freshDb()
    expect(() => withSqliteTransaction(db, () => {
      db.prepare('INSERT INTO t (id, value) VALUES (?, ?)').run('outer', 'x')
      withSqliteTransaction(db, () => {
        db.prepare('INSERT INTO t (id, value) VALUES (?, ?)').run('inner', 'y')
      })
      throw new Error('outer boom')
    })).toThrow('outer boom')
    expect(db.prepare('SELECT * FROM t').all()).toHaveLength(0)
    db.close()
  })

  it('uses savepoints for nested calls instead of raising cannot-start-transaction', () => {
    const db = freshDb()
    expect(() => withSqliteTransaction(db, () => {
      withSqliteTransaction(db, () => { db.prepare('INSERT INTO t (id, value) VALUES (?, ?)').run('a', '1') })
      withSqliteTransaction(db, () => { db.prepare('INSERT INTO t (id, value) VALUES (?, ?)').run('b', '2') })
    })).not.toThrow()
    expect((db.prepare('SELECT COUNT(*) AS c FROM t').get() as { c: number }).c).toBe(2)
    db.close()
  })

  it('rejects a Promise-returning callback and rolls back its writes', () => {
    const db = freshDb()
    expect(() => withSqliteTransaction(db, () => {
      db.prepare('INSERT INTO t (id, value) VALUES (?, ?)').run('a', 'x')
      return Promise.resolve('nope')
    })).toThrow(/synchronous/)
    expect(db.prepare('SELECT * FROM t').all()).toHaveLength(0)
    db.close()
  })
})

describe('withSqliteTransaction around TaskStore CRUD', () => {
  const attachment = { type: 'attachment' as const, id: '22222222-2222-4222-8222-222222222222', name: 'f.txt', mediaType: 'text/plain', bytes: 3 }
  const content = { version: 1 as const, blocks: [attachment] }

  it('rolls back content, version and attachment bytes when the outer operation fails', () => {
    const store = new TaskStore(fixture())
    try {
      const created = store.create({ title: 'Base', content, attachments: [{ id: attachment.id, data: 'YWJj' }] })
      expect(() => withSqliteTransaction(store.db, () => {
        store.update({ id: created.id, version: created.version, status: 'in_progress' })
        throw new Error('cancel everything')
      })).toThrow('cancel everything')
      const after = store.get(created.id)!
      expect(after.status).toBe('todo')
      expect(after.version).toBe(1)
      expect(store.readAttachments(created.id, after.version)).toEqual([{ id: attachment.id, data: 'YWJj' }])
    } finally { store.close() }
  })

  it('keeps a failed create inside the helper from leaving partial rows or bytes', () => {
    const store = new TaskStore(fixture())
    try {
      expect(() => withSqliteTransaction(store.db, () => {
        store.create({ title: 'Will roll back', content, attachments: [{ id: attachment.id, data: 'YWJj' }] })
        throw new Error('nope')
      })).toThrow('nope')
      expect(store.list().total).toBe(0)
      expect(store.db.prepare('SELECT * FROM task_attachments').all()).toHaveLength(0)
    } finally { store.close() }
  })
})
