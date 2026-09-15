# Gateway: única porta publicada no host. Roteia o SPA e a API sob a mesma origem.
FROM nginx:1.27-alpine

# Substitui o default.conf da imagem (que escuta na 80 e serve a página de boas-vindas).
RUN rm /etc/nginx/conf.d/default.conf
COPY conf.d/ /etc/nginx/conf.d/

# 80 já está ocupada no servidor; o gateway escuta na 8080 dentro e fora do container.
EXPOSE 8080