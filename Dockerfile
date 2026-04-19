FROM oven/bun:1.3.11-alpine AS build

WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
RUN bun run --cwd packages/client build

FROM oven/bun:1.3.11-alpine

WORKDIR /app
COPY . .
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/client/dist ./packages/client/dist

EXPOSE 4000
CMD ["bun", "run", "--cwd", "packages/server", "start"]
