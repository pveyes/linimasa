import { getIdentity } from "./auth.js"
import { LRUCache } from "./cache.js"
import {
  BookmarkDB,
  cursorToOffset,
  getJakselFeed as getJakselFeedDb,
  getUserBookmarks as getUserBookmarksDb,
  getUser as getUserDb,
  INIT_CURSOR,
  offsetToCursor
} from "./db.js"
import { Identity } from "./types.js"

export const userCache = new LRUCache<Identity>(1000)

export const getUser = async (did: string) => {
  const cached = userCache.get(did)
  if (cached) {
    return cached
  }

  const user = await getUserDb(did)
  if (user) {
    const identity = await getIdentity(did)
    if (!identity) {
      return null
    }

    userCache.set(did, identity)
  }

  return user
}

export const jakselFeedCache = new LRUCache<string[]>(30)

export const getJakselFeed = async (limit: number, cursor: string = INIT_CURSOR) => {
  const cached = jakselFeedCache.get(cursor)
  if (cached) {
    const offset = cursorToOffset(cursor)
    const nextCursor = offsetToCursor(offset + cached.length)
    return { posts: cached, nextCursor }
  }

  const { posts, nextCursor } = await getJakselFeedDb(limit, cursor)
  jakselFeedCache.set(cursor, posts)

  return { posts, nextCursor }
}

export const bookmarkCache = new LRUCache<BookmarkDB[]>(100)

export const getUserBookmarks = async (did: string) => {
  const cached = bookmarkCache.get(did)
  if (cached) {
    return cached
  }

  const bookmarks = await getUserBookmarksDb(did)
  if (bookmarks) {
    bookmarkCache.set(did, bookmarks)
  }

  return bookmarks
}

export const hasMatchingBookmarkCache = (did: string, uri: string) => {
  return bookmarkCache.get(did)?.some(b => b.post_uri === uri)
}

export const removeUriFromBookmarkCache = async (did: string, uri: string) => {
  const bookmarks = bookmarkCache.get(did)
  if (bookmarks) {
    bookmarkCache.set(did, bookmarks.filter(b => b.post_uri !== uri))
  }
}

