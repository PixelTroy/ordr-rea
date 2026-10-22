FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile --filter @ordr/web...
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @ordr/shared build && pnpm --filter @ordr/web build
EXPOSE 3000
ENV PORT=3000
CMD ["pnpm", "--filter", "@ordr/web", "start"]
