import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const migration = await readFile(new URL('../supabase/migrations/20261105000100_themes.sql', import.meta.url), 'utf8')
const roleDefaultsMigration = await readFile(new URL('../supabase/migrations/20261105000500_theme_role_defaults.sql', import.meta.url), 'utf8')

test('themes catalog: open read, closed write, one fixed row per non-workspace category', async (t) => {
  const db = await PGlite.create()
  t.after(() => db.close())

  // Minimal Supabase roles for local policy checks; themes has no auth.uid() dependency.
  await db.exec('create role anon; create role authenticated;')
  await db.exec(migration)
  await db.exec(roleDefaultsMigration)

  await t.test('anonymous and authenticated sessions both read the full seeded catalog', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`)
      const { rows } = await db.query('select id, category, hue, saturation from public.themes order by id')
      assert.deepEqual(rows, [
        { id: 'blue', category: 'workspace', hue: 215, saturation: 65 },
        { id: 'brown', category: 'signed_in', hue: 30, saturation: 35 },
        { id: 'green', category: 'workspace', hue: 140, saturation: 60 },
        { id: 'grey', category: 'signed_out', hue: 0, saturation: 0 },
        { id: 'red', category: 'workspace', hue: 0, saturation: 70 },
        { id: 'yellow', category: 'workspace', hue: 48, saturation: 80 },
      ])
      await db.exec('reset role')
    }
  })

  await t.test('green defaults for therapists and yellow for clients, nothing else', async () => {
    const { rows } = await db.query('select id, default_for_role from public.themes order by id')
    assert.deepEqual(rows, [
      { id: 'blue', default_for_role: null },
      { id: 'brown', default_for_role: null },
      { id: 'green', default_for_role: 'therapist' },
      { id: 'grey', default_for_role: null },
      { id: 'red', default_for_role: null },
      { id: 'yellow', default_for_role: 'client' },
    ])
  })

  await t.test('neither anonymous nor authenticated sessions can write', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`)
      await assert.rejects(
        db.query("insert into public.themes (id, category, hue, saturation) values ('purple', 'workspace', 270, 60)"),
        { code: '42501' },
      )
      await assert.rejects(
        db.query("update public.themes set hue = 10 where id = 'red'"),
        { code: '42501' },
      )
      await assert.rejects(
        db.query("delete from public.themes where id = 'red'"),
        { code: '42501' },
      )
      await db.exec('reset role')
    }
  })

  await t.test('a second signed_out or signed_in row is rejected, workspace stays multi-row', async () => {
    await assert.rejects(
      db.query("insert into public.themes (id, category, hue, saturation) values ('slate', 'signed_out', 220, 5)"),
      { code: '23505' },
    )
    await assert.rejects(
      db.query("insert into public.themes (id, category, hue, saturation) values ('tan', 'signed_in', 35, 30)"),
      { code: '23505' },
    )
    await db.query("insert into public.themes (id, category, hue, saturation) values ('purple', 'workspace', 270, 60)")
    const { rows } = await db.query("select id from public.themes where category = 'workspace' order by id")
    assert.deepEqual(rows.map((row) => row.id), ['blue', 'green', 'purple', 'red', 'yellow'])
  })

  await t.test('category, hue, and saturation are constrained', async () => {
    await assert.rejects(
      db.query("insert into public.themes (id, category, hue, saturation) values ('bad-category', 'admin', 0, 0)"),
      { code: '23514' },
    )
    await assert.rejects(
      db.query("insert into public.themes (id, category, hue, saturation) values ('bad-hue', 'workspace', 361, 0)"),
      { code: '23514' },
    )
    await assert.rejects(
      db.query("insert into public.themes (id, category, hue, saturation) values ('bad-saturation', 'workspace', 0, 101)"),
      { code: '23514' },
    )
  })

  await t.test('only a workspace-category theme may carry a role default', async () => {
    await assert.rejects(
      db.query("update public.themes set default_for_role = 'therapist' where id = 'grey'"),
      { code: '23514' },
    )
  })

  await t.test('at most one theme defaults per role', async () => {
    await assert.rejects(
      db.query("update public.themes set default_for_role = 'therapist' where id = 'blue'"),
      { code: '23505' },
    )
    await assert.rejects(
      db.query("update public.themes set default_for_role = 'client' where id = 'red'"),
      { code: '23505' },
    )
  })
})
