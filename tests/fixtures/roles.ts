import { test as base, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test'
import { STORAGE_STATE_DIR } from '../setup/config'
import { TEST_ACCOUNTS } from '../setup/accounts'

/**
 * Per-role Playwright fixtures (PRD §3 RBAC). Each fixture yields a browser
 * `Page` already authenticated as that account via the storage state written by
 * global-setup — so a spec just declares the role it needs:
 *
 *   test('officers reach the executive hub', async ({ officerPage }) => { … })
 *   test('guests are redirected', async ({ guestPage }) => { … })
 *
 * `apiAs(role)` gives an authenticated APIRequestContext for integration specs
 * that exercise endpoints directly. `guestPage` is an unauthenticated context.
 */
type RoleKey = 'member' | 'officer' | 'admin' | 'manager'

async function pageWithState(browser: BrowserContext['browser'], storageState: string | undefined) {
  const context = await browser!.newContext(storageState ? { storageState } : {})
  const page = await context.newPage()
  return { context, page }
}

interface RoleFixtures {
  guestPage: Page
  memberPage: Page
  officerPage: Page
  adminPage: Page
  managerPage: Page
  apiAs: (role: RoleKey | 'guest') => Promise<APIRequestContext>
  accounts: typeof TEST_ACCOUNTS
}

function statePath(role: RoleKey) {
  return `${STORAGE_STATE_DIR}/${role}.json`
}

export const test = base.extend<RoleFixtures>({
  guestPage: async ({ browser }, use) => {
    const { context, page } = await pageWithState(browser, undefined)
    await use(page)
    await context.close()
  },
  memberPage: async ({ browser }, use) => {
    const { context, page } = await pageWithState(browser, statePath('member'))
    await use(page)
    await context.close()
  },
  officerPage: async ({ browser }, use) => {
    const { context, page } = await pageWithState(browser, statePath('officer'))
    await use(page)
    await context.close()
  },
  adminPage: async ({ browser }, use) => {
    const { context, page } = await pageWithState(browser, statePath('admin'))
    await use(page)
    await context.close()
  },
  managerPage: async ({ browser }, use) => {
    const { context, page } = await pageWithState(browser, statePath('manager'))
    await use(page)
    await context.close()
  },
  apiAs: async ({ playwright, baseURL }, use) => {
    const created: APIRequestContext[] = []
    const factory = async (role: RoleKey | 'guest') => {
      const ctx = await playwright.request.newContext({
        baseURL: baseURL ?? undefined,
        ...(role === 'guest' ? {} : { storageState: statePath(role) }),
      })
      created.push(ctx)
      return ctx
    }
    await use(factory)
    await Promise.all(created.map(c => c.dispose()))
  },
  // Playwright requires the first fixture arg to be an object-destructuring
  // pattern; this fixture needs no upstream fixtures, hence the empty pattern.
  // eslint-disable-next-line no-empty-pattern
  accounts: async ({}, use) => {
    await use(TEST_ACCOUNTS)
  },
})

export { expect } from '@playwright/test'

/**
 * Navigate and wait for the Nuxt app to hydrate before interacting. Without
 * this, a fast click can fire a NATIVE form submit before Vue attaches its
 * `@submit.prevent` handler (the URL flips to `?`), which only shows up against
 * the dev server. `networkidle` is reached once the client bundle has loaded
 * and run — i.e. the page is interactive.
 */
export async function gotoReady(page: Page, path: string) {
  await page.goto(path)
  await page.waitForLoadState('networkidle')
}
