import { Agent } from "@atproto/api"
import { PIN_EMOJI } from "./constants.js"
import { Identity, Post } from "./types.js"

export async function getExistingUserBookmarks(
  identity: Identity,
  cursor?: string
): Promise<string[]> {
  const agent = new Agent(identity.pds)
  
  const resp = await agent.com.atproto.repo.listRecords({
    collection: "app.bsky.feed.post",
    repo: identity.did,
    limit: 100,
    cursor
  })

  if (!resp.success) {
    return []
  }

  const bookmarks = resp.data.records.flatMap(r => {
    const post = r.value as Post
    const isBookmark = post.text === PIN_EMOJI && post.reply?.parent.uri
    if (!isBookmark) {
      return []
    }
    
    return post.reply!.parent.uri
  })

  if (resp.data.cursor) {
    const nextBookmarks = await getExistingUserBookmarks(identity, resp.data.cursor)
    return bookmarks.concat(nextBookmarks)
  }

  return bookmarks
}
