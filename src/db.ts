import { Database, getPGDatabse, getSqliteDatabase } from "./adapter.js";
import { getExistingUserBookmarks } from "./repo.js";
import { Identity } from "./types.js";

let db: Database
let timestamp = ''
let currentTimestamp = ''

if (process.env.DB_URL) {
  timestamp = 'TIMESTAMP'
  currentTimestamp = 'NOW()'
  db = await getPGDatabse(process.env.DB_URL)
} else {
  timestamp = 'DATETIME'
  currentTimestamp = 'CURRENT_TIMESTAMP'
  db = getSqliteDatabase()
}

await migration()

async function migration() {
  await db.migrate(`
    CREATE TABLE IF NOT EXISTS users (
      did TEXT NOT NULL,
      PRIMARY KEY (did)
    );
    
    CREATE TABLE IF NOT EXISTS bookmarks (
      post_uri TEXT NOT NULL,
      user_did TEXT NOT NULL,
      created_at ${timestamp} DEFAULT ${currentTimestamp},
      PRIMARY KEY (post_uri, user_did)
    );
  `)
}

export async function resetDatabase() {
  await db.migrate(`
    DROP TABLE users;
    DROP TABLE bookmarks;
  `)

  await migration()
}

export interface BookmarkDB {
  post_uri: string
  user_did: string
}

export function addBookmark(uri: string, user_did: string) {
  return db.execute({ sql: `INSERT INTO bookmarks (post_uri, user_did) VALUES (?, ?)`, args: [uri, user_did] })
}

export function removeBookmark(uri: string, user_did: string) {
  return db.execute({ sql: `DELETE FROM bookmarks WHERE post_uri = ? AND user_did = ?`, args: [uri, user_did] })
}

export async function getUserBookmarks(did: string) {
  return db.execute<BookmarkDB[]>({ sql: `SELECT * FROM bookmarks WHERE user_did = ? ORDER BY created_at DESC`, args: [did]})
}

export interface UserDB {
  did: string
}

export async function getOrCreateUser(identity: Identity): Promise<UserDB> {
  const { did } = identity
  const users = await db.execute<UserDB[]>({ sql: `SELECT * FROM users WHERE did = ?`, args: [did] })
  if (users.length > 0) {
    return users[0]!
  };

  await db.execute({ sql: `INSERT INTO users (did) VALUES (?)`, args: [did] })

  // if user is new, fill up feed with their existing bookmarks
  const bookmarks = await getExistingUserBookmarks(identity)
  await db.execute({
    sql: `INSERT INTO bookmarks (post_uri, user_did) VALUES (?, ?)`,
    args: bookmarks.map(post_url => [post_url, did])
  })
  return { did }
}

