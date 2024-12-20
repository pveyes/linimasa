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
      source_uri TEXT,
      created_at ${timestamp} DEFAULT ${currentTimestamp},
      PRIMARY KEY (post_uri, user_did)
    );

    CREATE TABLE IF NOT EXISTS jaksel_feed (
      uri TEXT NOT NULL,
      created_at ${timestamp} DEFAULT ${currentTimestamp},
      PRIMARY KEY (uri)
    );
  `)
}

export async function resetDatabase() {
  await db.migrate(`
    DROP TABLE users;
    DROP TABLE bookmarks;
    DROP TABLE jaksel_feed;
  `)

  await migration()
}

export interface BookmarkDB {
  post_uri: string
  user_did: string
}

export function addBookmark(uri: string, user_did: string, source_uri: string) {
  return db.execute({ sql: `INSERT INTO bookmarks (post_uri, user_did, source_uri) VALUES (?, ?, ?)`, args: [uri, user_did, source_uri] })
}

export function removeBookmark(uri: string, user_did: string) {
  return db.execute({ sql: `DELETE FROM bookmarks WHERE (post_uri = ? OR source_uri = ?) AND user_did = ?`, args: [uri, uri, user_did] })
}

export async function getUserBookmarks(did: string) {
  return db.execute<BookmarkDB[]>({ sql: `SELECT * FROM bookmarks WHERE user_did = ? ORDER BY created_at DESC`, args: [did]})
}

export function addJakselFeed(uri: string) {
  return db.execute({ sql: `INSERT INTO jaksel_feed (uri) VALUES (?)`, args: [uri] })
}

export function removeJakselFeed(uri: string) {
  return db.execute({ sql: `DELETE FROM jaksel_feed WHERE uri = ?`, args: [uri] })
}

export async function getJakselFeed(limit: number, cursor: string) {
  const offset = cursorToOffset(cursor)
  const res = await db.execute<{ uri: string }[]>({ sql: `SELECT * FROM jaksel_feed ORDER BY created_at DESC LIMIT ? OFFSET ?`, args: [limit, offset] })

  return {
    posts: res.map(r => r.uri),
    nextCursor: offsetToCursor(offset + res.length)
  }
}

export const INIT_CURSOR = Buffer.from('init').toString('base64')

// simple cursor implementation return encoded offset
export function cursorToOffset(cursor: string) {
  if (cursor === INIT_CURSOR) {
    return 0
  }
  return cursor ? parseInt(Buffer.from(cursor, 'base64').toString('utf8').replace('cur','')) : 0
}

export function offsetToCursor(offset: number) {
  if (offset === 0) {
    return INIT_CURSOR
  }
  return Buffer.from('cur' + offset.toString()).toString('base64')
}

export interface UserDB {
  did: string
}

export async function getUser(did: string): Promise<UserDB | null> {
  const users = await db.execute<UserDB[]>({
    sql: `SELECT * FROM users WHERE did = ?`,
    args: [did]
  })

  if (users.length > 0) {
    return users[0]!
  };

  return null
}

export async function getOrCreateUser(identity: Identity): Promise<UserDB> {
  const { did } = identity
  const user = await getUser(did)
  if (user) {
    return user
  }

  await db.execute({ sql: `INSERT INTO users (did) VALUES (?)`, args: [did] })

  // if user is new, fill up feed with their existing bookmarks
  const bookmarks = await getExistingUserBookmarks(identity)
  await db.execute({
    sql: `INSERT INTO bookmarks (post_uri, user_did, source_uri) VALUES (?, ?)`,
    args: bookmarks.map(({ uri, source }) => [uri, did, source])
  })
  return { did }
}

