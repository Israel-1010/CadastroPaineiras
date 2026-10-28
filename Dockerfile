# syntax=docker/dockerfile:1

# Imagem da aplicação Next.js (Atualização Cadastral).
# Debian slim em vez de Alpine: o sharp (fotos/Dahua) usa binários prontos para glibc.
#
# Build:  docker build -t cadastro-paineiras .
# Rodar:  docker run -d --name cadastro-paineiras -p 3000:3000 \
#           --env-file .env.production --restart unless-stopped cadastro-paineiras
#
# Os segredos (.env) NÃO entram na imagem: são passados só ao rodar o container.

ARG NODE_VERSION=22

# ---------- 1) dependências ----------
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- 2) build ----------
FROM node:${NODE_VERSION}-bookworm-slim AS builder
WORKDIR /app
# O `next build` carrega as rotas para coletar metadados; estes valores de mentira só
# existem nesta etapa e não vão para a imagem final (lá valem os do --env-file).
ENV NEXT_TELEMETRY_DISABLED=1 \
    SUPABASE_URL=http://build.invalid \
    SUPABASE_SERVICE_ROLE_KEY=build-placeholder \
    SESSION_SECRET=build-placeholder-build-placeholder-000
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------- 3) execução ----------
FROM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Usuário sem privilégios de root
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

# Saída "standalone" do Next: servidor + apenas as dependências usadas
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
