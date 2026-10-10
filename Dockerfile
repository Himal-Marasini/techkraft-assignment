# ---- build ----
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN pnpm build && pnpm prune --prod

# ---- runtime ----
FROM node:24-alpine
WORKDIR /app

COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
RUN mkdir logs && chown node:node logs

# Never run the app as root inside the container.
USER node

EXPOSE 4041

# Apply pending migrations, then start the API.
CMD ["sh", "-c", "node node_modules/typeorm/cli.js -d dist/src/typeorm/data-source.js migration:run && node dist/src/main"]
