import { DidResolver, getPds } from '@atproto/identity';
import { AuthRequiredError, parseReqNsid, verifyJwt } from '@atproto/xrpc-server';
import { FastifyRequest } from "fastify";
import { Identity } from './types';

export async function getAuthUser(
  req: FastifyRequest,
  serviceDid: string,
  didResolver: DidResolver
): Promise<Identity | null> {
  const { authorization = '' } = req.headers
  if (!authorization.startsWith('Bearer ')) {
    throw new AuthRequiredError()
  }
  const jwt = authorization.replace('Bearer ', '').trim()
  const nsid = parseReqNsid(req)
  const parsed = await verifyJwt(jwt, serviceDid, nsid, async (did: string) => {
    return didResolver.resolveAtprotoKey(did)
  })
  
  return getIdentity(parsed.iss, didResolver)
}

export async function getIdentity(
  did: string,
  didResolver: DidResolver
): Promise<Identity | null> {
  const identity = await didResolver.resolve(did)
  if (!identity) {
    return null
  }

  const pds = getPds(identity)

  return {
    did: identity.id,
    pds: pds || 'https://bsky.social',
  }
}
