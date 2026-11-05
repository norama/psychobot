import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const workspacesMigration = await readFile(new URL('../supabase/migrations/20261104000100_workspaces.sql', import.meta.url), 'utf8')
const profilesMigration = await readFile(new URL('../supabase/migrations/20261105000300_profiles.sql', import.meta.url), 'utf8')
const workspacesProfileReferencesMigration = await readFile(new URL('../supabase/migrations/20261105000400_workspaces_profile_references.sql', import.meta.url), 'utf8')
const pairingSql = await readFile(new URL('../supabase/pair-test-accounts.sql', import.meta.url), 'utf8')

// Anna is therapist only. Jan is client to Anna and therapist to Petra — the
// dual-role fixture. Outsider stays unlinked throughout.
const anna = '10000000-0000-4000-8000-000000000001'
const jan = '10000000-0000-4000-8000-000000000002'
const petra = '10000000-0000-4000-8000-000000000003'
const outsider = '10000000-0000-4000-8000-000000000004'

async function asUser(db, user) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user])
}

test('demo fixture: dual-role pairing, profile name overrides, participant-only access', async (t) => {
  const db = await PGlite.create()
  t.after(() => db.close())

  // Minimal Supabase roles, user identities and JWT subject for local policy checks.
  // Each account's auth metadata uses a different "real" name than the fixture's
  // fictional one, so the override can be verified rather than assumed.
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
    insert into auth.users (id, email, raw_user_meta_data) values
      ('${anna}', 'anna@example.com', '{"full_name": "Anna Testerová"}'::jsonb),
      ('${jan}', 'jan@example.com', '{"full_name": "Honza Test"}'::jsonb),
      ('${petra}', 'petra@example.com', '{}'::jsonb),
      ('${outsider}', 'outsider@example.com', '{}'::jsonb);
  `)
  await db.exec(workspacesMigration)
  await db.exec(profilesMigration)
  await db.exec(workspacesProfileReferencesMigration)

  const pair = pairingSql
    .replace(/REPLACE_WITH_ANNA_USER_UUID/g, anna)
    .replace(/REPLACE_WITH_JAN_USER_UUID/g, jan)
    .replace(/REPLACE_WITH_PETRA_USER_UUID/g, petra)
  function pairingIds(execResults) {
    const select = execResults.find((result) => result.command === 'SELECT')
    return Object.fromEntries(select.rows.map((row) => [row.pairing, row.id]))
  }

  const idByPairing = pairingIds(await db.exec(pair))
  const annaJanWorkspace = idByPairing['Anna (therapist) ↔ Jan (client)']
  const janPetraWorkspace = idByPairing['Jan (therapist) ↔ Petra (client)']
  assert.ok(annaJanWorkspace && janPetraWorkspace && annaJanWorkspace !== janPetraWorkspace)

  const retriedIdByPairing = pairingIds(await db.exec(pair))
  assert.equal(retriedIdByPairing['Anna (therapist) ↔ Jan (client)'], annaJanWorkspace)
  assert.equal(retriedIdByPairing['Jan (therapist) ↔ Petra (client)'], janPetraWorkspace)

  await t.test('the fixture overrides each linked account\u2019s real name with the fictional demo name', async () => {
    const { rows } = await db.query('select id, display_name from public.profiles order by id')
    assert.deepEqual(rows, [
      { id: anna, display_name: 'Anna Jelínková' },
      { id: jan, display_name: 'Jan Novák' },
      { id: petra, display_name: 'Petra Dvořáková' },
      { id: outsider, display_name: 'outsider' },
    ])
  })

  await db.exec('set role authenticated')

  await t.test('Jan sees both connections: client to Anna, therapist to Petra', async () => {
    await asUser(db, jan)
    const { rows } = await db.query('select id, therapist_id, client_id from public.workspaces order by id')
    assert.deepEqual(rows.sort((a, b) => a.id.localeCompare(b.id)), [
      { id: annaJanWorkspace, therapist_id: anna, client_id: jan },
      { id: janPetraWorkspace, therapist_id: jan, client_id: petra },
    ].sort((a, b) => a.id.localeCompare(b.id)))
  })

  await t.test('Anna sees only her own workspace, as therapist', async () => {
    await asUser(db, anna)
    const { rows } = await db.query('select id, therapist_id, client_id from public.workspaces')
    assert.deepEqual(rows, [{ id: annaJanWorkspace, therapist_id: anna, client_id: jan }])
  })

  await t.test('Petra sees only her own workspace, as client', async () => {
    await asUser(db, petra)
    const { rows } = await db.query('select id, therapist_id, client_id from public.workspaces')
    assert.deepEqual(rows, [{ id: janPetraWorkspace, therapist_id: jan, client_id: petra }])
  })

  await t.test('a signed-in outsider sees no rows, even with a workspace ID', async () => {
    await asUser(db, outsider)
    const all = await db.query('select id from public.workspaces')
    const direct = await db.query('select id from public.workspaces where id = $1', [annaJanWorkspace])
    assert.deepEqual(all.rows, [])
    assert.deepEqual(direct.rows, [])
  })

  await t.test('a participant cannot create, alter, or remove a pairing', async () => {
    await asUser(db, anna)
    for (const [sql, targetClient] of [
      ['insert into public.workspaces (therapist_id, client_id) values ($1, $2)', outsider],
      ['update public.workspaces set client_id = client_id where therapist_id = $1 and client_id = $2', jan],
      ['delete from public.workspaces where therapist_id = $1 and client_id = $2', jan],
    ]) {
      await assert.rejects(db.query(sql, [anna, targetClient]), { code: '42501' })
    }
  })

  await t.test('anonymous access cannot read any workspace', async () => {
    await db.exec('set role anon')
    await db.query("select set_config('request.jwt.claim.sub', '', false)")
    await assert.rejects(
      db.query('select id from public.workspaces where id = $1', [annaJanWorkspace]),
      { code: '42501' },
    )
  })
})
