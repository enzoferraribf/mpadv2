FROM oven/bun:1.3.11-alpine AS build

WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
RUN bun run --cwd packages/client build

FROM oven/bun:1.3.11-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/bun.lock ./bun.lock
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/tsconfig.base.json ./tsconfig.base.json
COPY --from=build /app/tsconfig.bun.json ./tsconfig.bun.json
COPY --from=build /app/node_modules ./node_modules

COPY --from=build /app/packages/client/dist ./packages/client/dist

COPY --from=build /app/packages/server/package.json ./packages/server/package.json
COPY --from=build /app/packages/server/tsconfig.json ./packages/server/tsconfig.json
COPY --from=build /app/packages/server/node_modules ./packages/server/node_modules
COPY --from=build /app/packages/server/src ./packages/server/src

COPY --from=build /app/packages/core/package.json ./packages/core/package.json
COPY --from=build /app/packages/core/src ./packages/core/src

COPY --from=build /app/packages/protocol/package.json ./packages/protocol/package.json
COPY --from=build /app/packages/protocol/node_modules ./packages/protocol/node_modules
COPY --from=build /app/packages/protocol/src ./packages/protocol/src

COPY --from=build /app/packages/text-core/package.json ./packages/text-core/package.json
COPY --from=build /app/packages/text-core/node_modules ./packages/text-core/node_modules
COPY --from=build /app/packages/text-core/src ./packages/text-core/src

EXPOSE 4000
USER bun
CMD ["bun", "run", "--cwd", "packages/server", "start"]
