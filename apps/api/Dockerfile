FROM oven/bun:1.3.12-alpine AS production-deps

WORKDIR /app
COPY package.json bun.lock tsconfig.base.json tsconfig.bun.json tsconfig.browser.json tsconfig.lib.json tsconfig.workspace.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/web/vendor/noop-mermaid-to-excalidraw/package.json ./apps/web/vendor/noop-mermaid-to-excalidraw/package.json
COPY packages/core/package.json ./packages/core/package.json
COPY packages/protocol/package.json ./packages/protocol/package.json
COPY packages/testkit/package.json ./packages/testkit/package.json
COPY tools/tursoimport/package.json ./tools/tursoimport/package.json
RUN bun install --frozen-lockfile --production --filter @mpad/api

FROM oven/bun:1.3.12-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=production-deps /app/package.json ./package.json
COPY --from=production-deps /app/bun.lock ./bun.lock
COPY --from=production-deps /app/apps/api/package.json ./apps/api/package.json
COPY --from=production-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=production-deps /app/packages/core/package.json ./packages/core/package.json
COPY --from=production-deps /app/packages/protocol/package.json ./packages/protocol/package.json
COPY --from=production-deps /app/packages/protocol/node_modules ./packages/protocol/node_modules
COPY tsconfig.base.json tsconfig.bun.json tsconfig.lib.json tsconfig.workspace.json ./
COPY apps/api/tsconfig.json ./apps/api/tsconfig.json
COPY apps/api/src ./apps/api/src
COPY packages/core/src ./packages/core/src
COPY packages/protocol/src ./packages/protocol/src

EXPOSE 4000
USER bun
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD bun -e "const port=process.env.PORT||'4000'; const r=await fetch('http://127.0.0.1:'+port+'/health'); if (!r.ok) process.exit(1)"
CMD ["bun", "run", "--cwd", "apps/api", "start"]
