# WorkoutOrganizer SPA
# Contexto de build: ./frontend

FROM node:24-alpine AS build
WORKDIR /src

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vazio de propósito: com API_URL="" o client.ts monta URLs relativas (/api/...,
# /images/...), então o SPA fala com a própria origem e o nginx roteia para a API.
# Sobrescreva no build só se o SPA e a API forem servidos de origens diferentes.
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL

# tsc -b + vite build — erro de tipo quebra aqui, como no fluxo local.
RUN npm run build

# ---------------------------------------------------------------------------

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html

# Porta interna da rede do compose; nunca publicada no host (quem publica é o gateway em nginx/).
EXPOSE 80
