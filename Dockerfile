FROM oven/bun:1.3.11-alpine AS install

WORKDIR /app
COPY package.json bun.lock tsconfig.base.json tsconfig.bun.json tsconfig.browser.json tsconfig.lib.json tsconfig.workspace.json ./
COPY packages/client/package.json ./packages/client/package.json
COPY packages/server/package.json ./packages/server/package.json
COPY packages/core/package.json ./packages/core/package.json
COPY packages/protocol/package.json ./packages/protocol/package.json
COPY packages/text-core/package.json ./packages/text-core/package.json
COPY packages/testkit/package.json ./packages/testkit/package.json
COPY tools/tursoimport/package.json ./tools/tursoimport/package.json
RUN bun install --frozen-lockfile

FROM install AS build

COPY packages ./packages
COPY tools ./tools
RUN bun run --cwd packages/client build

FROM oven/bun:1.3.11-alpine AS production-deps

WORKDIR /app
COPY package.json bun.lock tsconfig.base.json tsconfig.bun.json tsconfig.browser.json tsconfig.lib.json tsconfig.workspace.json ./
COPY packages/client/package.json ./packages/client/package.json
COPY packages/server/package.json ./packages/server/package.json
COPY packages/core/package.json ./packages/core/package.json
COPY packages/protocol/package.json ./packages/protocol/package.json
COPY packages/text-core/package.json ./packages/text-core/package.json
COPY packages/testkit/package.json ./packages/testkit/package.json
COPY tools/tursoimport/package.json ./tools/tursoimport/package.json
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.3.11-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=production-deps /app/package.json ./package.json
COPY --from=production-deps /app/bun.lock ./bun.lock
COPY --from=production-deps /app/tsconfig.base.json ./tsconfig.base.json
COPY --from=production-deps /app/tsconfig.bun.json ./tsconfig.bun.json
COPY --from=production-deps /app/tsconfig.browser.json ./tsconfig.browser.json
COPY --from=production-deps /app/tsconfig.lib.json ./tsconfig.lib.json
COPY --from=production-deps /app/tsconfig.workspace.json ./tsconfig.workspace.json
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=production-deps /app/packages ./packages
COPY --from=production-deps /app/tools ./tools

COPY --from=build /app/packages/client/dist ./packages/client/dist

COPY --from=build /app/packages/server/tsconfig.json ./packages/server/tsconfig.json
COPY --from=build /app/packages/server/src ./packages/server/src

COPY --from=build /app/packages/core/src ./packages/core/src

COPY --from=build /app/packages/protocol/src ./packages/protocol/src

COPY --from=build /app/packages/text-core/src ./packages/text-core/src

EXPOSE 4000
USER bun
CMD ["bun", "run", "--cwd", "packages/server", "start"]
