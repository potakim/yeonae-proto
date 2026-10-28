import react from '@vitejs/plugin-react'
import { Readable } from 'node:stream'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/**
 * 로컬 개발용: /api/<이름> 을 Vercel 함수(api/<이름>.ts)와 같은 코드로 처리한다.
 * .env.local 의 ANTHROPIC_API_KEY 등을 서버 쪽에서만 읽는다 (VITE_ 접두사 없음 → 브라우저에 안 나감).
 */
function devApi(env: Record<string, string>): Plugin {
  return {
    name: 'modu-yeonae-dev-api',
    apply: 'serve',
    configureServer(server) {
      // 서버 함수가 process.env 를 읽으므로 .env.local 값을 넣어 둔다
      for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v
      server.middlewares.use('/api', async (req, res) => {
        const name = (req.url ?? '').split('?')[0].replace(/^\//, '').split('/')[0]
        if (!/^[a-z-]+$/.test(name)) {
          res.statusCode = 404
          res.end()
          return
        }
        try {
          const mod = await server.ssrLoadModule(`/api/${name}.ts`)
          const chunks: Buffer[] = []
          for await (const c of req) chunks.push(c as Buffer)
          const controller = new AbortController()
          res.on('close', () => controller.abort())
          const request = new Request(`http://localhost${req.originalUrl ?? '/api/' + name}`, {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
            signal: controller.signal,
          })
          const response: Response = await mod.default.fetch(request)
          res.statusCode = response.status
          response.headers.forEach((v, k) => res.setHeader(k, v))
          if (response.body) Readable.fromWeb(response.body as never).pipe(res)
          else res.end()
        } catch (e) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), devApi(loadEnv(mode, process.cwd(), ''))],
}))
