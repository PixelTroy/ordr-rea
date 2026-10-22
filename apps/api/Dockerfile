FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile --filter @ordr/api...
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @ordr/shared build \
  && pnpm --filter @ordr/api exec prisma generate \
  && pnpm --filter @ordr/api build
EXPOSE 4000
CMD ["sh", "-c", "pnpm --filter @ordr/api exec prisma migrate deploy && pnpm --filter @ordr/api start"]
