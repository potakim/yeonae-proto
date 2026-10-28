import react from '@vitejs/plugin-react'
import { Readable } from 'node:stream'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/**
 * 로컬 개발용: /api/interpret 를 Vercel 함수(api/interpret.ts)와 같은 코드로 처리한다.
 * .env.local 의 ANTHROPIC_API_KEY 등을 서버 쪽에서만 읽는다 (VITE_ 접두사 없음 → 브라우저에 안 나감).
 */
function devApi(env: Record<string, string>): Plugin {
  return {
    name: 'modu-yeonae-dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/interpret', async (req, res) => {
        try {
          const mod = await server.ssrLoadModule('/api/interpret.ts')
          const chunks: Buffer[] = []
          for await (const c of req) chunks.push(c as Buffer)
          const controller = new AbortController()
          res.on('close', () => controller.abort())
          const request = new Request(`http://localhost${req.originalUrl ?? '/api/interpret'}`, {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
            signal: controller.signal,
          })
          const response: Response = await mod.handleInterpret(request, { ...process.env, ...env })
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
