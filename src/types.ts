export interface Identity {
  did: string
  pds: string
}

export interface Post {
  text: string;
  $type: 'app.bsky.feed.post',
  langs: string[]
  reply?: {
    parent: {
      uri: string
    }
  }
}
