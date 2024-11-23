import { AtpAgent, BlobRef } from '@atproto/api'
import dotenv from 'dotenv'
import fs from 'fs/promises'
import inquirer from 'inquirer'

const run = async () => {
  dotenv.config()

  const answers = await inquirer
    .prompt([
      {
        type: 'input',
        name: 'handle',
        message: 'Enter your Bluesky handle:',
        required: true,
      },
      {
        type: 'password',
        name: 'password',
        message: 'Enter your Bluesky password (preferably an App Password):',
      }
    ])

  const { handle, password, } = answers

  // only update this if in a test environment
  const agent = new AtpAgent({ service: 'https://pds.pvey.es' })
  await agent.login({ identifier: handle, password})

  const getAvatarRef = async (avatar: string): Promise<BlobRef | undefined> => {
    let avatarRef: BlobRef | undefined
    if (avatar) {
      let encoding: string
      if (avatar.endsWith('png')) {
        encoding = 'image/png'
      } else if (avatar.endsWith('jpg') || avatar.endsWith('jpeg')) {
        encoding = 'image/jpeg'
      } else {
        throw new Error('expected png or jpeg')
      }
      const img = await fs.readFile('thumbs/' + avatar)
      const blobRes = await agent.api.com.atproto.repo.uploadBlob(img, {
        encoding,
      })
      avatarRef = blobRes.data.blob
    }

    return avatarRef
  }  

  await agent.api.com.atproto.repo.putRecord({
    repo: agent.session?.did ?? '',
    collection: 'app.bsky.feed.generator',
    rkey: 'poormark',
    record: {
      did: 'did:web:linimasa.pvey.es',
      displayName: 'Poormark',
      description: `Poor Man's Bookmark. Reply to any post with only 📌 to bookmark`,
      avatar: await getAvatarRef('poormark.png'),
      createdAt: new Date().toISOString(),
    },
  })

  await agent.api.com.atproto.repo.putRecord({
    repo: agent.session?.did ?? '',
    collection: 'app.bsky.feed.generator',
    rkey: 'jaksel',
    record: {
      did: 'did:web:linimasa.pvey.es',
      displayName: 'Jaksel',
      description: `Post with mix of English and Indonesian languages`,
      avatar: await getAvatarRef('jaksel.png'),
      createdAt: new Date().toISOString(),
    },
  })

  console.log('All done 🎉')
}

run()
