import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const workspacesMigration = await readFile(new URL('../supabase/migrations/20261104000100_workspaces.sql', import.meta.url), 'utf8')
const profilesMigration = await readFile(new URL('../supabase/migrations/20261105000300_profiles.sql', import.meta.url), 'utf8')
const workspacesProfileReferencesMigration = await readFile(new URL('../supabase/migrations/20261105000400_workspaces_profile_references.sql', import.meta.url), 'utf8')
const themesMigration = await readFile(new URL('../supabase/migrations/20261105000100_themes.sql', import.meta.url), 'utf8')
const preferencesMigration = await readFile(new URL('../supabase/migrations/20261105000600_workspace_theme_preferences.sql', import.meta.url), 'utf8')
const roleDefaultsMigration = await readFile(new URL('../supabase/migrations/20261105000500_theme_role_defaults.sql', import.meta.url), 'utf8')

const therapist = '10000000-0000-4000-8000-000000000001'
const client = '10000000-0000-4000-8000-000000000002'
const outsider = '10000000-0000-4000-8000-000000000003'

async function asUser(db, user) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user])
}

test('workspace theme preferences: private per (person, workspace), restricted to workspace-category themes', async (t) => {
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
    insert into auth.users (id, email) values
      ('${therapist}', 'anna@example.com'),
      ('${client}', 'jan@example.com'),
      ('${outsider}', 'outsider@example.com');
  `)
  await db.exec(workspacesMigration)
  await db.exec(profilesMigration)
  await db.exec(workspacesProfileReferencesMigration)
  await db.exec(themesMigration)
  await db.exec(roleDefaultsMigration)
  await db.exec(preferencesMigration)

  const [{ rows: [workspace] }] = await db.exec(`
    insert into public.workspaces (therapist_id, client_id)
    values ('${therapist}', '${client}')
    returning id
  `)

  await db.exec('set role authenticated')

  await t.test('a participant can set, read, and update only their own preference', async () => {
    await asUser(db, therapist)
    await db.query(
      'insert into public.workspace_theme_preferences (user_id, workspace_id, theme_id) values ($1, $2, $3)',
      [therapist, workspace.id, 'blue'],
    )
    await db.query(
      'update public.workspace_theme_preferences set theme_id = $3 where user_id = $1 and workspace_id = $2',
      [therapist, workspace.id, 'green'],
    )
    const { rows } = await db.query(
      'select theme_id from public.workspace_theme_preferences where user_id = $1 and workspace_id = $2',
      [therapist, workspace.id],
    )
    assert.deepEqual(rows, [{ theme_id: 'green' }])
  })

  await t.test('the other participant cannot see or change that preference, only their own', async () => {
    await asUser(db, client)
    const { rows } = await db.query('select * from public.workspace_theme_preferences')
    assert.deepEqual(rows, [])

    await db.query(
      'insert into public.workspace_theme_preferences (user_id, workspace_id, theme_id) values ($1, $2, $3)',
      [client, workspace.id, 'red'],
    )
    const update = await db.query(
      'update public.workspace_theme_preferences set theme_id = $1 where user_id = $2 and workspace_id = $3',
      ['yellow', therapist, workspace.id],
    )
    assert.equal(update.affectedRows ?? 0, 0)

    const own = await db.query(
      'select theme_id from public.workspace_theme_preferences where user_id = $1 and workspace_id = $2',
      [client, workspace.id],
    )
    assert.deepEqual(own.rows, [{ theme_id: 'red' }])

    await asUser(db, therapist)
    const stillGreen = await db.query(
      'select theme_id from public.workspace_theme_preferences where user_id = $1 and workspace_id = $2',
      [therapist, workspace.id],
    )
    assert.deepEqual(stillGreen.rows, [{ theme_id: 'green' }])
  })

  await t.test('a non-participant cannot create a preference for that workspace, even for themselves', async () => {
    await asUser(db, outsider)
    await assert.rejects(
      db.query(
        'insert into public.workspace_theme_preferences (user_id, workspace_id, theme_id) values ($1, $2, $3)',
        [outsider, workspace.id, 'blue'],
      ),
      { code: '42501' },
    )
  })

  await t.test('a participant cannot forge a preference row under someone else\u2019s user_id', async () => {
    await asUser(db, therapist)
    await assert.rejects(
      db.query(
        'insert into public.workspace_theme_preferences (user_id, workspace_id, theme_id) values ($1, $2, $3)',
        [outsider, workspace.id, 'blue'],
      ),
      { code: '42501' },
    )
  })

  await t.test('only workspace-category themes are assignable, not signed_out/signed_in', async () => {
    await asUser(db, therapist)
    await assert.rejects(
      db.query(
        'update public.workspace_theme_preferences set theme_id = $1 where user_id = $2 and workspace_id = $3',
        ['grey', therapist, workspace.id],
      ),
      { code: '23503' },
    )
  })

  await t.test('an owner can delete their own preference, reverting to the default', async () => {
    await asUser(db, therapist)
    await db.query(
      'delete from public.workspace_theme_preferences where user_id = $1 and workspace_id = $2',
      [therapist, workspace.id],
    )
    const { rows } = await db.query(
      'select 1 from public.workspace_theme_preferences where user_id = $1 and workspace_id = $2',
      [therapist, workspace.id],
    )
    assert.deepEqual(rows, [])
  })

  await t.test('deleting the workspace cascades away any remaining preferences', async () => {
    await db.exec('reset role')
    await db.query('delete from public.workspaces where id = $1', [workspace.id])
    const { rows } = await db.query('select 1 from public.workspace_theme_preferences')
    assert.deepEqual(rows, [])
  })

  await t.test('anonymous sessions have no access at all', async () => {
    await db.exec('set role anon')
    await db.query("select set_config('request.jwt.claim.sub', '', false)")
    await assert.rejects(
      db.query('select 1 from public.workspace_theme_preferences'),
      { code: '42501' },
    )
  })
})
