FROM oven/bun:1.3.12-alpine AS deps

WORKDIR /app
COPY package.json bun.lock tsconfig.base.json tsconfig.browser.json tsconfig.workspace.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/dashboard/package.json ./apps/dashboard/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/web/vendor/noop-mermaid-to-excalidraw/package.json ./apps/web/vendor/noop-mermaid-to-excalidraw/package.json
COPY packages/core/package.json ./packages/core/package.json
COPY packages/protocol/package.json ./packages/protocol/package.json
COPY packages/testkit/package.json ./packages/testkit/package.json
RUN bun install --frozen-lockfile

FROM deps AS build

COPY apps/dashboard ./apps/dashboard
COPY packages/core ./packages/core
RUN bun run --filter @mpad/dashboard build

FROM oven/bun:1.3.12-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV DASHBOARD_HOST=0.0.0.0
ENV DASHBOARD_PORT=4010

COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/bun.lock ./bun.lock
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/dashboard/package.json ./apps/dashboard/package.json
COPY --from=build /app/apps/dashboard/dist ./apps/dashboard/dist
COPY --from=build /app/apps/dashboard/src ./apps/dashboard/src
COPY --from=build /app/packages/core ./packages/core
COPY tsconfig.base.json tsconfig.browser.json tsconfig.workspace.json ./

EXPOSE 4010
USER bun
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD bun -e "const host=process.env.DASHBOARD_HOST||'127.0.0.1'; const port=process.env.DASHBOARD_PORT||'4010'; const r=await fetch('http://'+host+':'+port+'/api/health'); if (!r.ok) process.exit(1)"
CMD ["bun", "run", "--cwd", "apps/dashboard", "start"]
