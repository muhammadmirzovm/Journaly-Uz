# Railway frontend image. Root Directory = frontend/, so this build context
# is just this folder.
#
# VITE_API_URL is a build-time arg (Vite bakes env vars into the JS bundle
# at build time, not read at runtime) — set it as a Railway build variable
# pointing at the backend service's public domain.

FROM node:22.12-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN unset NPM_CONFIG_INIT_VERSION npm_config_init_version NPM_CONFIG_VERSION npm_config_version && \
    npm ci --no-audit --no-fund
COPY . .
ARG VITE_API_URL
ARG VITE_VAPID_PUBLIC_KEY
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_VAPID_PUBLIC_KEY=${VITE_VAPID_PUBLIC_KEY}
RUN npm run build

FROM node:22.12-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN unset NPM_CONFIG_INIT_VERSION npm_config_init_version NPM_CONFIG_VERSION npm_config_version && \
    npm ci --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist

# Railway injects $PORT — `serve -s` gives SPA fallback (any unknown path
# returns index.html instead of 404, so client-side routes work on refresh).
CMD ["sh", "-c", "./node_modules/.bin/serve -s dist -l tcp://0.0.0.0:${PORT:-3000}"]
