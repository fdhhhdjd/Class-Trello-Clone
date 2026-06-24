# Standalone Next.js. Build context = apps/landing (no @trello/ui dependency)
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# NEXT_PUBLIC_* must be present at build time (inlined into the bundle).
ARG NEXT_PUBLIC_USER_APP_URL
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_USER_APP_URL=$NEXT_PUBLIC_USER_APP_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN npm run build

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
