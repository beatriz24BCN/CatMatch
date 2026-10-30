import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ detail: 'Method not allowed' })
  }

  const { baseUrl, person, cat } = req.body || {}
  if (!baseUrl || !person || !cat) {
    return res.status(400).json({ detail: 'Provide baseUrl, person and cat in the request body' })
  }

  try {
    const backendUrl = baseUrl.replace(/\/$/, '') + '/api/match/evaluate'
    const resp = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ person, cat }),
    })

    const text = await resp.text()
    let data: any = null
    try {
      data = text ? JSON.parse(text) : null
    } catch (e) {
      data = text
    }

    res.status(resp.status).json({ status: resp.status, body: data })
  } catch (err: any) {
    res.status(500).json({ detail: 'Error contacting backend', error: String(err) })
  }
}
