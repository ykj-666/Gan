FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./

# 可选：通过构建参数设置代理
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NPM_REGISTRY=https://registry.npmjs.org

ENV HTTP_PROXY=${HTTP_PROXY}
ENV HTTPS_PROXY=${HTTPS_PROXY}
ENV http_proxy=${HTTP_PROXY}
ENV https_proxy=${HTTPS_PROXY}

RUN npm config set registry ${NPM_REGISTRY} \
    && npm config set fund false \
    && npm config set audit false

# 若提供了代理，则一并配置
RUN if [ -n "${HTTP_PROXY}" ]; then npm config set proxy ${HTTP_PROXY}; fi \
    && if [ -n "${HTTPS_PROXY}" ]; then npm config set https-proxy ${HTTPS_PROXY}; fi \
    && if [ -n "${HTTP_PROXY}" ]; then npm config set strict-ssl false; fi

RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit

FROM deps AS build
COPY . .
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/db ./db
COPY --from=build /app/package.json ./
COPY --from=build /app/scripts/start-production.cjs ./scripts/

EXPOSE 3000
CMD ["node", "scripts/start-production.cjs"]
