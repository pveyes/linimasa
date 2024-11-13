import { getIdentity } from "./auth.js"
import { LRUCache } from "./cache.js"
import { BookmarkDB, getUserBookmarks as getUserBookmarksDb, getUser as getUserDb } from "./db.js"
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
