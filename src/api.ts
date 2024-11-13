import { DidResolver, MemoryCache } from "@atproto/identity";
import Fastify from "fastify";
import { getAuthUser, getIdentity } from "./auth.js";
import { DID, HOST } from "./constants.js";
import { getOrCreateUser, getUserBookmarks } from "./db.js";

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

const didCache = new MemoryCache()
const didResolver = new DidResolver({
  plcUrl: 'https://plc.directory',
  didCache
})

// test playground
server.route({
  method: 'GET',
  url: '/test',
  handler: async (req, res) => {
    const did = (req.query as any).did || DID
    const identity = (await getIdentity(did, didResolver))!
    await getOrCreateUser(identity)
    const bookmarks = await getUserBookmarks(identity.did)
    res.send({ identity, bookmarks })
  }
})

// Construct the feed
server.route({
  method: "GET",
  url: "/xrpc/app.bsky.feed.getFeedSkeleton",
  handler: async (req, res) => {
    // get user from auth header
    const identity = await getAuthUser(req, didResolver);
    if (!identity) {
      return res.send({ feed: [] });
    }

    const dbUser = await getOrCreateUser(identity)

    // TODO: Implement cursor
    // const { feed, cursor } = req.query as Record<string, string | undefined>;
    const { feed } = req.query as Record<string, string | undefined>;
    switch (feed) {
      case `at://${DID}/app.bsky.feed.generator/poormark`: {
        const data = await getUserBookmarks(dbUser.did);
        res.send({ feed: data.map(d => {
          return {
            post: d.uri
          }
        }) });
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
