// Initialize the database: apply schema.sql, then seed resources from the
// canonical data module (server/data/resources.js) when it is available.
//
// Plans are NEVER seeded — a plan only exists after a user intentionally
// creates one. The database stays empty of plans until then.
//
// Usage: npm run db:init   (requires DATABASE_URL in server/.env)
import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { dbConfigured, initDb, query } from './db.js'
// Optional seed source. The module may be intentionally empty/commented out
// (Postgres is the source of truth), so tolerate a missing export.
import * as mockData from '../data/resources.js'

const resources = mockData.resources || []
const __dirname = dirname(fileURLToPath(import.meta.url))

async function main() {
  if (!dbConfigured()) {
    console.error('DATABASE_URL is not set. Add it to server/.env first.')
    process.exit(1)
  }
  const ok = await initDb()
  if (!ok) {
    console.error('Could not connect to the database. Check DATABASE_URL and that Postgres is running.')
    process.exit(1)
  }

  console.log('Applying schema…')
  const schema = await readFile(join(__dirname, 'schema.sql'), 'utf8')
  await query(schema)

  if (resources.length === 0) {
    console.log('No resource seed data present (server/data/resources.js is empty) — skipping resource seed.')
  } else {
    console.log(`Seeding ${resources.length} resources…`)
    for (const r of resources) {
      const eligibilityText = Array.isArray(r.eligibility)
        ? r.eligibility.join('; ')
        : r.eligibility ?? null
      await query(
        `INSERT INTO resources (id, name, category, provider, description, phone, website, eligibility, support, data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           category = EXCLUDED.category,
           provider = EXCLUDED.provider,
           description = EXCLUDED.description,
           phone = EXCLUDED.phone,
           website = EXCLUDED.website,
           eligibility = EXCLUDED.eligibility,
           support = EXCLUDED.support,
           data = EXCLUDED.data`,
        [
          r.id,
          r.name,
          r.category,
          r.provider,
          r.description ?? null,
          r.contact?.phone ?? r.phone ?? null,
          r.website ?? null,
          eligibilityText,
          r.support ?? null,
          JSON.stringify(r), // full UI-shaped record
        ],
      )
    }
  }

  console.log('Done. Database initialized (no plans seeded).')
  process.exit(0)
}

main().catch((err) => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
