import { getIdentity } from "./auth.js"
import { LRUCache } from "./cache.js"
import {
  BookmarkDB,
  getJakselFeed as getJakselFeedDb,
  getUserBookmarks as getUserBookmarksDb,
  getUser as getUserDb
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

const sharedFeedCache = new LRUCache(100)

const JAKSEL_FEED_KEY = 'jaksel-feed'

export const jakselFeedCache = {
  get: () => sharedFeedCache.get<string[]>(JAKSEL_FEED_KEY),
  set: (value: string[]) => sharedFeedCache.set(JAKSEL_FEED_KEY, value),
  delete: (uri?: string) => {
    const feed = sharedFeedCache.get<string[]>(JAKSEL_FEED_KEY)
    if (feed && uri) {
      return sharedFeedCache.set(JAKSEL_FEED_KEY, feed.filter(f => f !== uri))
    }
    sharedFeedCache.delete(JAKSEL_FEED_KEY)
  }
}

export const getJakselFeed = async (): Promise<string[]> => {
  const cached = jakselFeedCache.get()
  if (cached) {
    return cached
  }

  const feed = await getJakselFeedDb()
  if (feed) {
    jakselFeedCache.set(feed)
  }

  return feed
}

export const hasMatchingJakselFeedCache = (uri: string) => {
  return jakselFeedCache.get()?.includes(uri)
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

