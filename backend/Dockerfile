# WorkoutOrganizer API
# Contexto de build: ./backend (a pasta que contém o .slnx e o projeto).

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore em camada separada: só reexecuta quando o .csproj muda.
COPY WorkoutOrganizer.Api/WorkoutOrganizer.Api.csproj WorkoutOrganizer.Api/
RUN dotnet restore WorkoutOrganizer.Api/WorkoutOrganizer.Api.csproj

COPY WorkoutOrganizer.Api/ WorkoutOrganizer.Api/
RUN dotnet publish WorkoutOrganizer.Api/WorkoutOrganizer.Api.csproj \
    -c Release -o /out --no-restore

# ---------------------------------------------------------------------------

FROM mcr.microsoft.com/dotnet/aspnet:10.0

# O Program.cs resolve workout.db, images/ e videos/ como ContentRootPath/../..,
# então o binário precisa ficar dois níveis abaixo da "raiz do repositório".
# Aqui a raiz é /app; o compose monta workout.db, images/ e videos/ lá.
WORKDIR /app/backend/WorkoutOrganizer.Api
COPY --from=build /out .

# Mesma porta do launchSettings, para os docs e o nginx não precisarem de outra.
ENV ASPNETCORE_HTTP_PORTS=5199
EXPOSE 5199

# Roda como root de propósito: workout.db entra por bind mount e o SQLite precisa
# escrever nele e criar o -journal ao lado. Com o usuário "app" da imagem base o
# arquivo do host (dono = seu usuário, 644) viraria "attempt to write a readonly database".
ENTRYPOINT ["dotnet", "WorkoutOrganizer.Api.dll"]
