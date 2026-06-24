# Build context = frontend repo ROOT (needs packages/ui)
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps ./apps
RUN npm ci --workspaces --include-workspace-root
RUN npm run build -w @trello/user

FROM nginx:alpine
COPY apps/user/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/user/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
