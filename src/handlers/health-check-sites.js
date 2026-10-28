import fetch from 'node-fetch'
import { AbortController } from 'node-abort-controller'

//! TARGETSはカンマ区切りの検証対象URL
const targets = process.env.TARGETS.split(',')
//! WEBHOOK_URLはSlackのWebhook URL
let webhookurl = process.env.WEBHOOK_URL

const getWebhookUrl = async () => {
  if (webhookurl) return webhookurl

  const secretArn = process.env.WEBHOOK_SECRET_ARN
  if (!secretArn) throw new Error('WEBHOOK_SECRET_ARN is required')

  const { SecretsManagerClient, GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager')
  const client = new SecretsManagerClient()
  const { SecretString } = await client.send(new GetSecretValueCommand({ SecretId: secretArn }))
  if (!SecretString) throw new Error('Slack webhook secret is empty')

  webhookurl = SecretString
  return webhookurl
}

const send2Slack = async text => {
  const webhookUrl = await getWebhookUrl()
  return fetch(webhookUrl, {
    method: 'post',
    body: JSON.stringify({ text })
  })
}

/**
 * A Lambda function that check health of some sites
 */
export const healthCheckSites = async () => {
  await send2Slack(`health-check-sites: On invoked, I show targets list
${targets.join('\n')}`)
  await Promise.all(targets.map(async (target) => {// 全てのURLに対して
    const controller = new AbortController()
    const signal = controller.signal
    const promise = fetch(target, { signal }).catch(e => // GETを送信して問題があれば
      send2Slack(`<!here> Error: url; ${target} detail; ${e}`) // slackに通知する
    )
    setTimeout(() => controller.abort(), 11000)
    return promise
  }))
  return {success: true}
}
