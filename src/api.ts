import Fastify from "fastify";
import { getAuthUser } from "./auth.js";
import { DID, HOST } from "./constants.js";
import { getOrCreateUser } from "./db.js";
import { getUserBookmarks, userCache } from "./loader.js";

const server = Fastify({
  logger: true,
});

server.route({
  method: 'GET',
  url: '/',
  handler: (_, res) => {
    res.redirect('https://bsky.app/profile/pvey.es/feed/poormark')
  }
})

// Tell Bluesky about the feed
server.route({
  method: "GET",
  url: "/.well-known/did.json",
  handler: async (_, res) => {
    res.send({
      "@context": ["https://www.w3.org/ns/did/v1"],
      id: DID,
      service: [
        {
          id: "#bsky_fg",
          serviceEndpoint: `https://${HOST}`,
          type: "BskyFeedGenerator",
        },
      ],
    });
  },
});

// Define the feeds we support
server.route({
  method: "GET",
  url: "/xrpc/app.bsky.feed.describeFeedGenerator",
  handler: async (_, res) => {
    res.send({
      did: DID,
      feeds: [
        {
          uri: `at://${DID}/app.bsky.feed.generator/poormark`,
        },
      ],
    });
  },
});

// test playground
server.route({
  method: 'GET',
  url: '/test',
  handler: async (req, res) => {
    const did = (req.query as any).did || DID
    const data = await getUserBookmarks(did);
    res.send({
      feed: data.map(d => {
        return {
          post: d.post_uri
        }
      })
    });
}
})

// Construct the feed
server.route({
  method: "GET",
  url: "/xrpc/app.bsky.feed.getFeedSkeleton",
  handler: async (req, res) => {
    // get user from auth header
    const identity = await getAuthUser(req);
    if (!identity) {
      return res.send({ feed: [] });
    }

    const cachedUser = userCache.get(identity.did)
    if (!cachedUser) {
      console.log('User not found in cache, fetching from db', identity.did)
      await getOrCreateUser(identity)
    }
    userCache.set(identity.did, identity)

    // TODO: Implement cursor
    // const { feed, cursor } = req.query as Record<string, string | undefined>;
    const { feed } = req.query as Record<string, string | undefined>;
    switch (feed) {
      case `at://${DID}/app.bsky.feed.generator/poormark`: {
        const data = await getUserBookmarks(identity.did);
        res.send({
          feed: data.map(d => {
            return {
              post: d.post_uri
            }
          })
        });
        return;
      }
      default: {
        res.code(404).send();
      }
    }
  },
});

const host = process.env.HOST || '0.0.0.0'
const port = process.env.PORT ? parseInt(process.env.PORT) : 4000;
server.listen({ host, port }).then(() => {
  console.log(`Server listening on port ${port}`);
});
