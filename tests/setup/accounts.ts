import type { AccountStatus } from '../../shared/utils/roles'

/**
 * The standard test accounts, one per rung of the RBAC ladder (PRD §3.1) plus a
 * meeting-manager context. Emails use the reserved `.test` TLD so they can never
 * collide with or email a real person. Passwords are throwaway (test DB only).
 *
 * Club-agnostic: no real names. These are seeded idempotently by global-setup
 * via the real register endpoint (correct password hashing) then promoted in the
 * DB to the intended status — see tests/setup/global-setup.ts.
 */
export interface TestAccount {
  key: 'guest' | 'member' | 'officer' | 'admin' | 'manager'
  name: string
  email: string
  password: string
  status: AccountStatus
}

export const PASSWORD = 'test-password-123'

export const TEST_ACCOUNTS: Record<TestAccount['key'], TestAccount> = {
  // Verified email but never approved for membership — exercises the guest gate.
  guest: { key: 'guest', name: 'Test Guest', email: 'guest@toastily.test', password: PASSWORD, status: 'guest' },
  member: { key: 'member', name: 'Test Member', email: 'member@toastily.test', password: PASSWORD, status: 'member' },
  officer: { key: 'officer', name: 'Test Officer', email: 'officer@toastily.test', password: PASSWORD, status: 'officer' },
  admin: { key: 'admin', name: 'Test Admin', email: 'admin@toastily.test', password: PASSWORD, status: 'admin' },
  // A plain member who will hold an authority-granting meeting role (e.g.
  // Toastmaster) on a specific meeting — for contextual meeting-manager tests.
  manager: { key: 'manager', name: 'Test Manager', email: 'manager@toastily.test', password: PASSWORD, status: 'member' },
}

export const ALL_ACCOUNTS = Object.values(TEST_ACCOUNTS)

/** Roles for which we persist an authenticated Playwright storage state. */
export const AUTHED_KEYS = ['member', 'officer', 'admin', 'manager'] as const
