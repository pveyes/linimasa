import { AppBskyFeedPost } from "@atproto/api";
import { CommitCreateEvent, Jetstream } from "@skyware/jetstream";
import WebSocket from "ws";
import { PIN_EMOJI } from "./constants.js";
import {
  addBookmark,
  addJakselFeed,
  getUser,
  removeBookmark,
  removeJakselFeed
} from "./db.js";
import {
  bookmarkCache,
  hasMatchingBookmarkCache,
  hasMatchingJakselFeedCache,
  jakselFeedCache,
  removeUriFromBookmarkCache
} from "./loader.js";

const jetstream = new Jetstream({
  ws: WebSocket,
  wantedCollections: [
    "app.bsky.feed.post",
  ],
});

jetstream.onCreate("app.bsky.feed.post", async (event) => {
  const post = event.commit.record as any

  if (isJakselType(post)) {
    return handleJakselAdded(post, event)
  }

  if (isBookmarkType(post)) {
    return handleBookmarkAdded(post, event)
  }
});

jetstream.onDelete("app.bsky.feed.post", async (event) => {
  const did = event.did
  const rkey = event.commit.rkey
  const uri = `at://${did}/app.bsky.feed.post/${rkey}`

  if (hasMatchingJakselFeedCache(uri)) {
    jakselFeedCache.delete(uri)
  }
  
  if (hasMatchingBookmarkCache(did, uri)) {
    removeUriFromBookmarkCache(did, uri)
  }
  
  return Promise.allSettled([
    removeJakselFeed(uri),
    removeBookmark(uri, did)
  ])
})

function isJakselType(post: AppBskyFeedPost.Record) {
  return post.langs?.length === 2 && post.langs.includes('en') && post.langs.includes('id')
}

async function handleJakselAdded(_: AppBskyFeedPost.Record, event: CommitCreateEvent<any>) {
  const did = event.did
  const rkey = event.commit.rkey
  const uri = `at://${did}/app.bsky.feed.post/${rkey}`

  console.log('Jaksel added', uri)
  const feed = jakselFeedCache.get() ?? []
  jakselFeedCache.set(feed.concat(uri))
  return addJakselFeed(uri)
}

function isBookmarkType(post: AppBskyFeedPost.Record) {
  return post.text === PIN_EMOJI && post.reply?.parent
}

async function handleBookmarkAdded(post: AppBskyFeedPost.Record, event: CommitCreateEvent<any>) {
  const did = event.did
  const rkey = event.commit.rkey
  const uri = post.reply!.parent.uri
  const source = `at://${did}/app.bsky.feed.post/${rkey}`

  // Only add to database if the user already visited the feed
  const user = await getUser(did)
  if (!user) {
    return
  }

  console.log('Bookmark added for did', did, 'uri', uri, 'source', source)
  const bookmarks = bookmarkCache.get(did) ?? []
  bookmarkCache.set(did, bookmarks.concat({ post_uri: uri, user_did: did }))
  return addBookmark(uri, did, source)
}

jetstream.start();
console.log('Jetstream started');
