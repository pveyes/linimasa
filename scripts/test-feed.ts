import { AtpAgent } from '@atproto/api'
import { DID, HOST } from '../src/constants.js'

const run = async () => {
  const agent = new AtpAgent({ service: `https://${HOST}` })

  const result = await agent.api.app.bsky.feed.getFeedSkeleton(
    {
      feed: `at://${DID}/app.bsky.feed.generator/jaksel`,
      // The feedgen is not guaranteed to honor the limit, but we try it.
      limit: 30,
    },
    {
      headers: {},
    },
  )

  console.log('result', result.data)
}

run()


