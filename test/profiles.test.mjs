import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const workspacesMigration = await readFile(new URL('../supabase/migrations/20261104000100_workspaces.sql', import.meta.url), 'utf8')
const profilesMigration = await readFile(new URL('../supabase/migrations/20261105000300_profiles.sql', import.meta.url), 'utf8')
const workspacesProfileReferencesMigration = await readFile(new URL('../supabase/migrations/20261105000400_workspaces_profile_references.sql', import.meta.url), 'utf8')

const therapist = '10000000-0000-4000-8000-000000000001'
const client = '10000000-0000-4000-8000-000000000002'
const outsider = '10000000-0000-4000-8000-000000000003'
const newcomer = '10000000-0000-4000-8000-000000000004'

async function asUser(db, user) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user])
}

test('profiles: backfill and auto-creation, self/counterpart read, self-only rename', async (t) => {
  const db = await PGlite.create()
  t.after(() => db.close())

  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users (
      id uuid primary key,
      email text,
      raw_user_meta_data jsonb not null default '{}'::jsonb
    );
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
  `)
  await db.exec(workspacesMigration)

  // Pre-existing accounts, as if they had signed in before this migration
  // ever ran, to exercise the one-time backfill rather than the trigger.
  await db.query(
    "insert into auth.users (id, email, raw_user_meta_data) values ($1, 'anna@example.com', '{\"full_name\": \"Anna Jelínková\"}'::jsonb)",
    [therapist],
  )
  await db.query(
    "insert into auth.users (id, email, raw_user_meta_data) values ($1, 'jan@example.com', '{\"name\": \"Jan Novák\"}'::jsonb)",
    [client],
  )
  await db.query(
    "insert into auth.users (id, email) values ($1, 'outsider@example.com')",
    [outsider],
  )

  await db.exec(profilesMigration)
  await db.exec(workspacesProfileReferencesMigration)

  await db.exec(`
    insert into public.workspaces (therapist_id, client_id)
    values ('${therapist}', '${client}')
  `)

  await t.test('backfill covers pre-existing accounts with full_name, name, or email fallback', async () => {
    const { rows } = await db.query('select id, display_name from public.profiles order by id')
    assert.deepEqual(rows, [
      { id: therapist, display_name: 'Anna Jelínková' },
      { id: client, display_name: 'Jan Novák' },
      { id: outsider, display_name: 'outsider' },
    ])
  })

  await t.test('the trigger auto-creates a profile for a newly signed-up user', async () => {
    await db.query(
      "insert into auth.users (id, email, raw_user_meta_data) values ($1, 'nova@example.com', '{\"full_name\": \"Nova Příchozí\"}'::jsonb)",
      [newcomer],
    )
    const { rows } = await db.query('select display_name from public.profiles where id = $1', [newcomer])
    assert.deepEqual(rows, [{ display_name: 'Nova Příchozí' }])
  })

  await db.exec('set role authenticated')

  await t.test('a participant reads their own profile and their counterpart\u2019s, not an unrelated one', async () => {
    await asUser(db, therapist)
    const { rows } = await db.query('select id, display_name from public.profiles order by id')
    assert.deepEqual(rows, [
      { id: therapist, display_name: 'Anna Jelínková' },
      { id: client, display_name: 'Jan Novák' },
    ])

    await asUser(db, client)
    const clientView = await db.query('select id, display_name from public.profiles order by id')
    assert.deepEqual(clientView.rows, [
      { id: therapist, display_name: 'Anna Jelínková' },
      { id: client, display_name: 'Jan Novák' },
    ])
  })

  await t.test('an unrelated account only reads its own profile', async () => {
    await asUser(db, outsider)
    const { rows } = await db.query('select id, display_name from public.profiles order by id')
    assert.deepEqual(rows, [{ id: outsider, display_name: 'outsider' }])
  })

  await t.test('a user can rename themselves but not another participant', async () => {
    await asUser(db, therapist)
    await db.query("update public.profiles set display_name = 'Anna Nováková' where id = $1", [therapist])
    const { rows } = await db.query('select display_name from public.profiles where id = $1', [therapist])
    assert.deepEqual(rows, [{ display_name: 'Anna Nováková' }])

    const otherAttempt = await db.query("update public.profiles set display_name = 'Hacked' where id = $1", [client])
    assert.equal(otherAttempt.affectedRows, 0)
    const clientName = await db.query('select display_name from public.profiles where id = $1', [client])
    assert.deepEqual(clientName.rows, [{ display_name: 'Jan Novák' }])
  })

  await t.test('id cannot be changed, even on an owned row', async () => {
    await asUser(db, therapist)
    await assert.rejects(
      db.query('update public.profiles set id = $1 where id = $2', [outsider, therapist]),
      { code: '42501' },
    )
  })

  await t.test('no authenticated session can insert or delete profiles directly', async () => {
    await asUser(db, therapist)
    await assert.rejects(
      db.query(
        "insert into public.profiles (id, display_name) values ($1, 'Forged')",
        [outsider],
      ),
      { code: '42501' },
    )
    await assert.rejects(
      db.query('delete from public.profiles where id = $1', [client]),
      { code: '42501' },
    )
  })

  await t.test('anonymous sessions have no access at all', async () => {
    await db.exec('set role anon')
    await db.query("select set_config('request.jwt.claim.sub', '', false)")
    await assert.rejects(
      db.query('select 1 from public.profiles'),
      { code: '42501' },
    )
  })
})
