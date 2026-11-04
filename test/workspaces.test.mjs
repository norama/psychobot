import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const migration = await readFile(new URL('../supabase/migrations/20261104000100_workspaces.sql', import.meta.url), 'utf8')
const pairingSql = await readFile(new URL('../supabase/pair-test-accounts.sql', import.meta.url), 'utf8')

const therapist = '10000000-0000-4000-8000-000000000001'
const client = '10000000-0000-4000-8000-000000000002'
const outsider = '10000000-0000-4000-8000-000000000003'

test('workspace pairing and participant-only access', async (t) => {
  const db = await PGlite.create()
  t.after(() => db.close())

  // Minimal Supabase roles, user identities and JWT subject for local policy checks.
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    insert into auth.users values ('${therapist}'), ('${client}'), ('${outsider}');
  `)
  await db.exec(migration)

  const pair = pairingSql
    .replace('REPLACE_WITH_THERAPIST_USER_UUID', therapist)
    .replace('REPLACE_WITH_CLIENT_USER_UUID', client)
  const [{ rows: [workspace] }] = await db.exec(pair)
  const [{ rows: [retriedWorkspace] }] = await db.exec(pair)
  assert.equal(retriedWorkspace.id, workspace.id)

  await t.test('both members read the same persisted row, including by direct ID', async () => {
    await db.exec('set role authenticated')
    for (const user of [therapist, client]) {
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user])
      const { rows } = await db.query('select * from public.workspaces')
      assert.deepEqual(rows, [{
        id: workspace.id,
        therapist_id: therapist,
        client_id: client,
        therapist_name: 'Anna Jelínková',
        client_name: 'Jan Novák',
      }])
      const direct = await db.query('select * from public.workspaces where id = $1', [workspace.id])
      assert.deepEqual(direct.rows, rows)
    }
  })

  await t.test('a signed-in outsider sees no rows, even with the workspace ID', async () => {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [outsider])
    const all = await db.query('select id from public.workspaces')
    const direct = await db.query('select id from public.workspaces where id = $1', [workspace.id])
    assert.deepEqual(all.rows, [])
    assert.deepEqual(direct.rows, [])
  })

  await t.test('a participant cannot create, alter, or remove a pairing', async () => {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [therapist])
    for (const [sql, targetClient] of [
      ["insert into public.workspaces (therapist_id, client_id, therapist_name, client_name) values ($1, $2, 'Anna', 'Other')", outsider],
      ["update public.workspaces set client_name = 'Other' where therapist_id = $1 and client_id = $2", client],
      ["delete from public.workspaces where therapist_id = $1 and client_id = $2", client],
    ]) {
      await assert.rejects(db.query(sql, [therapist, targetClient]), { code: '42501' })
    }
  })

  await t.test('anonymous access cannot read the workspace', async () => {
    await db.exec('set role anon')
    await db.query("select set_config('request.jwt.claim.sub', '', false)")
    await assert.rejects(
      db.query('select id from public.workspaces where id = $1', [workspace.id]),
      { code: '42501' },
    )
  })
})
