import { AtpAgent } from '@atproto/api'
import dotenv from 'dotenv'
import inquirer from 'inquirer'

const run = async () => {
  dotenv.config()

  const answers = await inquirer
    .prompt([
      {
        type: 'input',
        name: 'handle',
        message: 'Enter your Bluesky handle',
        required: true,
      },
      {
        type: 'password',
        name: 'password',
        message: 'Enter your Bluesky password (preferably an App Password):',
      },
    ])

  const { handle, password } = answers

  // only update this if in a test environment
  const agent = new AtpAgent({ service: 'https://pds.pvey.es' })
  await agent.login({ identifier: handle, password })

  await agent.api.com.atproto.repo.deleteRecord({
    repo: agent.session?.did ?? '',
    collection: 'app.bsky.feed.generator',
    rkey: 'poormark',
  })
  await agent.api.com.atproto.repo.deleteRecord({
    repo: agent.session?.did ?? '',
    collection: 'app.bsky.feed.generator',
    rkey: 'jaksel',
  })

  console.log('All done 🎉')
}

run()
