import fetch from 'node-fetch'

//! TARGETSはカンマ区切りの検証対象URL
const targets = process.env.TARGETS.split(',')
//! WEBHOOK_URLはSlackのWebhook URL
const webhookurl = process.env.WEBHOOK_URL

const send2Slack = async text => fetch(webhookurl, {
  method: 'post',
  body: JSON.stringify({ text })
})

/**
 * A Lambda function that check health of some sites
 */
export const healthCheckSites = async () => {
  await send2Slack(`health-check-sites: On invoked, I show targets list
${targets.join('\n')}`)
  await Promise.all(targets.map(async (target) => // 全てのURLに対して
    fetch(target).catch(e => // GETを送信して問題があれば
      send2Slack(`<!here> Error: url; ${target} detail; ${e}`) // slackに通知する
    )
  ))
}
