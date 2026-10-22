import fs from 'node:fs'
import path from 'node:path'
import { expect } from '@playwright/test'

export const ROOT = path.resolve(import.meta.dirname, '..')
export const EX = (f) => path.join(ROOT, 'docs/examples', f)
export const FIX = (f) => path.join(ROOT, 'e2e/fixtures', f)
export const LEGACY_REAL = path.join(ROOT, 'tests/fixtures/backup-v2-reale.json')
export const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))
export const NOW = new Date('2026-10-31T10:00:00+01:00')

// Apre l'app con data fissa (test indipendenti dal giorno di esecuzione); le finestre di conferma vengono accettate
export async function openApp(page, { legacy = null, clock = true } = {}) {
  page.on('dialog', (d) => d.accept())
  if (clock) await page.clock.install({ time: NOW })
  if (legacy) await page.addInitScript((data) => localStorage.setItem('palestra:data', data), JSON.stringify(legacy))
  await page.goto('/')
  await expect(page.getByRole('navigation', { name: 'Navigazione principale' })).toBeVisible()
}

export const nav = (page, name) => page.getByRole('navigation', { name: 'Navigazione principale' }).getByRole('button', { name }).click()
export const tab = (page, name) => page.getByRole('tab', { name, exact: true }).click()

export async function goImport(page) {
  await nav(page, /Altro/)
  await tab(page, 'Importa')
}

// Import di un file con conferma; restituisce il testo del risultato
export async function importFile(page, file, { expectOk = true } = {}) {
  await page.locator('input[type=file]').setInputFiles(file)
  await page.getByRole('button', { name: 'Importa', exact: true }).click()
  if (expectOk) await expect(page.getByText(/Inseriti \d+ · aggiornati \d+ · saltati \d+/)).toBeVisible()
}

// Stato salvato davvero in IndexedDB (non lo stato in memoria)
export const savedState = (page) =>
  page.evaluate(
    () =>
      new Promise((res, rej) => {
        const r = indexedDB.open('palestra')
        r.onerror = () => rej(r.error)
        r.onsuccess = () => {
          const g = r.result.transaction('kv').objectStore('kv').get('state')
          g.onsuccess = () => res(g.result)
        }
      }),
  )

export async function waitSaved(page) {
  await expect(page.getByRole('status').filter({ hasText: 'Salvato sul dispositivo' })).toBeVisible()
}

export const main = (page) => page.locator('main')
