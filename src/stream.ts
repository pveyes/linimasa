import { Jetstream } from "@skyware/jetstream";
import WebSocket from "ws";
import { PIN_EMOJI } from "./constants.js";
import { addBookmark, getUser, removeBookmark } from "./db.js";
import { bookmarkCache } from "./loader.js";

const jetstream = new Jetstream({
  ws: WebSocket,
  wantedCollections: [
    "app.bsky.feed.post",
  ],
});

jetstream.onCreate("app.bsky.feed.post", async (event) => {
  const post = event.commit.record

  // Bail out early if it's not a bookmark
  if (
    post.text !== PIN_EMOJI ||
    !post.reply?.parent
  ) {
    return
  }

  const did = event.did
  const rkey = event.commit.rkey
  const uri = `at://${did}/app.bsky.feed.post/${rkey}`

  // Only add to database if the user already visited the feed
  const user = await getUser(did)
  if (!user) {
    return
  }

  console.log('Bookmark added for did', did, 'uri', uri)
  bookmarkCache.delete(did)
  return addBookmark(uri, did)
});

jetstream.onDelete("app.bsky.feed.post", async (event) => {
  const did = event.did
  const rkey = event.commit.rkey
  const uri = `at://${did}/app.bsky.feed.post/${rkey}`

  // Only remove from database if the user already visited the feed
  const user = await getUser(did)
  if (!user) {
    return
  }

  console.log('Bookmark removed for did', did, 'uri', uri)
  bookmarkCache.delete(did)
  return removeBookmark(uri, did)
})

jetstream.start();
console.log('Jetstream started');
