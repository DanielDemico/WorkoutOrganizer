<p align="center">
  <img src="frontend/public/Icon-noBg.png" alt="WorkoutOrganizer" width="220" />
</p>

<h1 align="center">WorkoutOrganizer</h1>

<p align="center">
  Monte seus treinos por dia da semana, marque o que fez, importe a ficha da academia por foto
  e veja no mapa corporal quais músculos o seu plano está trabalhando.
</p>

<p align="center">
  <img alt=".NET 10" src="https://img.shields.io/badge/.NET-10-512BD4?logo=dotnet&logoColor=white" />
  <img alt="React 19" src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white" />
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-Python%203.13-009688?logo=fastapi&logoColor=white" />
  <img alt="SQLite" src="https://img.shields.io/badge/SQLite-workout.db-003B57?logo=sqlite&logoColor=white" />
</p>

---

## Sumário

- [O que ele faz](#o-que-ele-faz)
- [Arquitetura](#arquitetura)
- [Como funciona, peça por peça](#como-funciona-peça-por-peça)
  - [1. Autenticação](#1-autenticação)
  - [2. Ciclo semanal e conclusão por data](#2-ciclo-semanal-e-conclusão-por-data)
  - [3. Importação de ficha por documento](#3-importação-de-ficha-por-documento)
  - [4. Heatmap muscular](#4-heatmap-muscular)
  - [5. Internacionalização](#5-internacionalização)
- [Modelo de dados](#modelo-de-dados)
- [Rodando o projeto](#rodando-o-projeto)
- [Verificando](#verificando)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Regras que não se quebram](#regras-que-não-se-quebram)
- [Documentação](#documentação)

---

## O que ele faz

| | |
|---|---|
| 🗓️ **Treinos por dia da semana** | Cada treino tem exercícios distribuídos de `segunda` a `domingo`, com séries (`4x12`), ordem e observação. Editar, trocar, excluir e arrastar na criação. |
| ✅ **Marcar o que foi feito** | A conclusão é registrada numa **data absoluta**, não no dia da semana — a mesma segunda pode estar feita esta semana e pendente na próxima, sem nenhuma rotina de "virar a semana". |
| 📓 **Anotações da sessão** | Peso por série e observação livre penduradas na conclusão. O que você fez em 12/09 não muda quando o plano muda. |
| 📆 **Calendário mensal** | Visão do mês com os dias concluídos e um modal de celebração quando todo o dia é fechado. |
| 📸 **Importar ficha por foto/PDF/planilha** | Envie a ficha da academia (imagem, HEIC, PDF, XLSX, CSV, TXT). Um microserviço Python extrai a rotina via LLM, casa cada linha com o catálogo de 1324 exercícios e devolve o treino pronto para revisão. |
| 💪 **Heatmap muscular** | Cada exercício do plano pontua o músculo alvo (2) e os secundários (1); a soma é projetada em 80 regiões de um SVG do corpo humano. |
| 🌐 **PT / EN** | Todo texto do dataset (nomes, instruções, grupos musculares) tem tradução em tabelas próprias; a interface troca de idioma sem recarregar. |
| 🎬 **Catálogo com mídia** | 1324 exercícios com imagem, GIF de execução e passo a passo, servidos pela própria API. |

---

## Arquitetura

Três processos e um arquivo SQLite compartilhado. O banco é escrito por **dois donos**
(os scripts Python de ETL e o EF Core do .NET) e lido por um terceiro (o `document-service`,
somente-leitura).

```mermaid
flowchart LR
    subgraph Browser["Navegador"]
        SPA["React 19 + Vite<br/>localhost:5173"]
    end

    subgraph API["ASP.NET Core 10<br/>localhost:5199"]
        CTRL["Controllers<br/>Auth · Users · Workouts<br/>Exercises · UserExercises"]
        EF["EF Core (SQLite)"]
        STATIC["Arquivos estáticos<br/>/images · /videos"]
        DSC["DocumentServiceClient"]
    end

    subgraph DOC["document-service (FastAPI)<br/>localhost:5200"]
        PARSE["POST /parse"]
        EXTR["extractor.py<br/>leitor por tipo de arquivo"]
        CAT["catalog.py<br/>catálogo em memória + fuzzy"]
    end

    OR["OpenRouter<br/>modelo primário + fallback"]

    DB[("workout.db<br/>SQLite")]
    ASSETS[("images/ · videos/")]

    subgraph ETL["ETL (Python, roda uma vez)"]
        B1["build_database.py"]
        B2["build_muscle_mapping.py"]
        B3["build_translations.py"]
    end
    JSON["exercises.json<br/>1324 exercícios"]

    SPA -- "JSON + Bearer JWT" --> CTRL
    SPA -- "img / gif" --> STATIC
    CTRL --> EF --> DB
    STATIC --> ASSETS
    CTRL -- "multipart (import)" --> DSC -- "HTTP" --> PARSE
    PARSE --> EXTR --> OR
    PARSE --> CAT
    CAT -. "leitura (mode=ro)" .-> DB

    JSON --> B1 --> DB
    B2 --> DB
    B3 --> DB
```

**Quem escreve o quê em `workout.db`:**

```mermaid
flowchart TB
    subgraph DATASET["Tabelas de dataset — donas: scripts Python"]
        direction LR
        E["exercises"]
        EI["exercise_instructions<br/>exercise_instruction_steps"]
        ESM["exercise_secondary_muscles"]
        MT["muscle_term<br/>muscle_mapping"]
        I18N["exercise_i18n<br/>exercise_instruction_step_i18n<br/>term_i18n"]
        U["user"]
    end

    subgraph APP["Tabelas de aplicação — donas: migrations EF Core"]
        direction LR
        W["workout"]
        WE["workout_exercise"]
        WEC["workout_exercise_completion"]
        N["exercise_note<br/>exercise_note_set"]
    end

```

No EF, as tabelas de dataset são mapeadas com `ToTable(..., t => t.ExcludeFromMigrations())`:
o .NET lê delas, nunca as recria. A única exceção é `user.refresh_token`, adicionada por
`ALTER TABLE` escrito à mão dentro de uma migration.

---

## Como funciona, peça por peça

### 1. Autenticação

Access token JWT de **15 min** + refresh token opaco de **3 h**, rotacionado a cada uso e
guardado em `user.refresh_token`. O `userId` **sempre** sai do claim `sub` do token — nenhuma
rota aceita id de dono no corpo, na query ou na rota.

```mermaid
sequenceDiagram
    autonumber
    participant SPA
    participant API as API (.NET)
    participant DB as workout.db

    SPA->>API: POST /api/auth/login { name, password }
    API->>DB: SELECT user WHERE name
    API->>API: BCrypt.Verify(password, hash_pass)
    API->>DB: UPDATE user SET refresh_token, refresh_token_expiry (+3h)
    API-->>SPA: { accessToken (15 min), refreshToken, refreshTokenExpiresAt }

    loop A cada requisição autenticada
        SPA->>API: Authorization: Bearer accessToken
        API->>API: valida assinatura + expiração<br/>userId = claims["sub"]
    end

    Note over SPA,API: access token expirou (401)
    SPA->>API: POST /api/auth/refresh { refreshToken }
    API->>DB: SELECT user WHERE refresh_token = ? AND expiry > now
    API->>DB: UPDATE user SET refresh_token = novo (rotação)
    API-->>SPA: novo par de tokens

    SPA->>API: POST /api/auth/logout { refreshToken }
    API->>DB: UPDATE user SET refresh_token = NULL
    API-->>SPA: 204
```

> `MapInboundClaims = false` no JwtBearer é o que faz o claim `sub` chegar intacto — sem isso o
> ASP.NET Core o renomeia para `ClaimTypes.NameIdentifier`.

### 2. Ciclo semanal e conclusão por data

A semana **não é um estado que reseta**: é uma janela de 7 datas calculada a partir de "hoje"
(`frontend/src/lib/weekCycle.ts`). O plano define *o que* fazer em cada dia da semana; a
tabela `workout_exercise_completion` registra *em qual data* cada slot foi feito.

```mermaid
flowchart LR
    subgraph PLANO["Plano (fixo)"]
        WE1["workout_exercise 7<br/>dia = segunda, ordem = 1<br/>Supino reto · 4x12"]
    end

    subgraph HIST["Histórico (uma linha por data)"]
        C1["completion<br/>date = 2026-09-07 · feito"]
        C2["completion<br/>date = 2026-09-14 · feito"]
        C3["(2026-09-21 — ainda não existe)"]
    end

    WE1 --> C1
    WE1 --> C2
    WE1 -.-> C3

    C2 --> N1["exercise_note<br/>text = 'subi a carga'<br/>sets = [40, 40, 42.5, 42.5] kg"]
```

Regras que o servidor impõe:

- `POST .../completions { date }` é **upsert** — marcar duas vezes a mesma data não duplica.
- A data tem de cair no mesmo dia da semana do slot (`400` caso contrário).
- A resposta traz `diaConcluido: true` quando **todo** exercício de **todos** os treinos do
  usuário agendado naquele dia da semana está feito nessa data — é o gatilho do modal de celebração.
- A anotação (`exercise_note`) pende da **conclusão**, não do slot: só se anota o que já foi feito
  (`404` sem conclusão), e apagar o slot cascateia conclusões e anotações.

### 3. Importação de ficha por documento

O backend é só um gateway autenticado. Quem lê o arquivo e fala com o LLM é o
`document-service` (FastAPI, porta 5200). Cada tipo de arquivo usa a estratégia **mais barata
que o resolve**: planilha e PDF digital viram texto determinístico; imagem, HEIC e PDF escaneado
seguem pelo caminho multimodal.

```mermaid
sequenceDiagram
    autonumber
    participant SPA
    participant API as API (.NET)
    participant DOC as document-service
    participant OR as OpenRouter
    participant DB as workout.db

    SPA->>API: POST /api/workouts/import (multipart file, ?lang)
    API->>API: valida: obrigatório, ≤ 15 MB, extensão permitida
    API->>DOC: POST /parse (file, lang)

    DOC->>DOC: extractor.prepare_content(ext)
    alt .xlsx .xls .csv .txt / PDF com texto
        DOC->>DOC: pandas / pypdf → texto
    else .png .jpg .webp .heic / PDF escaneado
        DOC->>DOC: Pillow / PyMuPDF → imagem redimensionada
    end

    DOC->>DB: catalog.py lê exercises + exercise_i18n (mode=ro)
    DOC->>OR: chat/completions<br/>system prompt + catálogo inteiro ([id] nome, ~15k tokens)<br/>models: [primário, fallback]
    OR-->>DOC: JSON { dias: [{ dia, exercicios: [{ nome, series, exercise_id? }] }] }

    DOC->>DOC: normalize_day · sanitize_series<br/>valida exercise_id contra o catálogo<br/>fuzzy só gera sugestões, nunca vincula
    DOC->>DOC: observacao = "🤖 Ficha: '…' ➜ Catálogo: '…' 🤖"
    DOC-->>API: { nome, items: [{ dia, exerciseId | null, originalName, series, observacao, suggestions }] }

    API->>DB: BEGIN · INSERT workout · INSERT workout_exercise × N<br/>(exercise_id nulo → custom_name) · COMMIT
    API-->>SPA: 201 { workoutId, exercises, degradedReason }
    SPA->>SPA: abre a tela de criação já populada, com aviso de revisão
```

Decisões que vieram da medição, não da intuição (ver [spec 0008](specs/0008-otimizacao-document-service/spec.md)):

- **O fuzzy matching não atribui exercício.** Contra 46 nomes correntes de academia ele acertou
  3 (7%); todo limiar com recall útil admitia falso positivo (`"Remada máquina"` casava 100 com um
  exercício de ombro). Hoje só o *exact match* e o id **escolhido pelo LLM e validado** vinculam.
- **Exercício sem equivalente é persistido**, não fica pendente: `workout_exercise.custom_name`
  preenchido, `exercise_id` nulo, marcado na UI como fora do catálogo ([spec 0010](specs/0010-exercicio-fora-do-catalogo/spec.md)).
- **Falha de parser nunca degrada para bytes crus no LLM.** Planilha corrompida é `400` com o
  tipo nomeado; `degradedReason` só vem quando o arquivo foi legível como texto simples.

### 4. Heatmap muscular

```mermaid
flowchart LR
    WE["workout_exercise<br/>(todo o plano do usuário,<br/>só exercícios de catálogo)"]
    T["exercises.target<br/><b>+2 pontos</b>"]
    S["exercise_secondary_muscles<br/><b>+1 ponto</b> cada"]
    MT["muscle_term<br/>vocabulário do dataset (50 termos)"]
    MM["muscle_mapping<br/>termo → regiões do SVG (N→N)"]
    SVG["80 regiões do body-muscles<br/>ex.: abs-upper-left"]
    SCALE["intensity = max(1, round(points / maxPoints × 10))<br/>escala relativa ao próprio usuário"]
    UI["BodyHeatmap.tsx<br/>+ lista ranqueada por termo"]

    WE --> T --> MT
    WE --> S --> MT
    MT --> MM --> SVG --> SCALE --> UI
    MT -. "sem região (ex.: cardiovascular system)" .-> IGN["ignored[]"]
```

Cada região recebe a pontuação **inteira** do termo, nunca dividida. `term` e `muscleId` são
chaves de contrato e continuam em inglês; só `label` passa por `term_i18n`.

### 5. Internacionalização

- Toda rota com texto do dataset aceita `?lang=pt|en` (default `pt`; outro valor é `400`).
- Tradução mora em `exercise_i18n`, `exercise_instruction_step_i18n` e `term_i18n` — tabelas
  **próprias**, fora do alcance do reimport do dataset.
- Falta de tradução cai para o inglês do dataset, exercício a exercício, nunca para `null`.
- A busca (`GET /api/exercises?search=`) casa contra `name_norm` (minúsculo, sem acento):
  `torcao` acha `Torção`.
- No frontend, `en.ts` é tipado a partir de `pt.ts` — esquecer uma chave quebra o build.

---

## Modelo de dados

```mermaid
erDiagram
    user {
        int id PK
        text name UK
        text hash_pass
        text refresh_token
        text refresh_token_expiry
    }
    workout {
        int workout_id PK
        int user_id FK
        text nome
    }
    workout_exercise {
        int id PK
        int workout_id FK
        text exercise_id FK "nulo se fora do catálogo"
        text custom_name "nulo se de catálogo"
        text dia "CHECK segunda..domingo"
        int ordem "MAX+1 por (workout, dia)"
        text series "regex NxN"
        text observacao
    }
    workout_exercise_completion {
        int id PK
        int workout_exercise_id FK
        text date "YYYY-MM-DD"
        int feito
        text concluded_at
    }
    exercise_note {
        int id PK
        int completion_id FK
        text text
    }
    exercise_note_set {
        int id PK
        int note_id FK
        int set_number "1..N contíguo"
        real weight "CHECK 0 < w <= 1000"
    }
    exercises {
        text id PK
        text name
        text category
        text body_part
        text equipment
        text muscle_group
        text target
        text image
        text gif_url
    }
    exercise_secondary_muscles {
        text exercise_id FK
        text muscle
    }
    exercise_i18n {
        text exercise_id FK
        text lang
        text name
        text name_norm
        text instructions
    }
    muscle_term {
        text term PK
        text label_pt
    }
    muscle_mapping {
        text term FK
        text muscle_id "id da região do SVG"
    }
    term_i18n {
        text kind
        text term
        text lang
        text label
    }

    user ||--o{ workout : "possui"
    workout ||--o{ workout_exercise : "cascade"
    exercises |o--o{ workout_exercise : "restrict"
    workout_exercise ||--o{ workout_exercise_completion : "cascade"
    workout_exercise_completion ||--o| exercise_note : "cascade"
    exercise_note ||--o{ exercise_note_set : "cascade"
    exercises ||--o{ exercise_secondary_muscles : "tem"
    exercises ||--o{ exercise_i18n : "traduz"
    muscle_term ||--o{ muscle_mapping : "projeta"
    muscle_term ||--o{ term_i18n : "traduz"
```

Invariantes garantidos **no banco**, não só no código:

| Onde | Regra |
|---|---|
| `workout_exercise.dia` | `CHECK IN ('segunda','terça','quarta','quinta','sexta','sabado','domingo')` — com cedilha em `terça`, sem acento em `sabado` |
| `workout_exercise` | `UNIQUE (workout_id, dia, ordem)`; exatamente um de `exercise_id` / `custom_name` |
| `exercise_note_set.weight` | `CHECK (weight > 0 AND weight <= 1000)` |
| FKs | `PRAGMA foreign_keys` ligado; cascade de `user → workout → workout_exercise → completion → note` |

---

## Rodando o projeto

Três terminais. Não há Docker nem script de orquestração.

### 1 · API — `http://localhost:5199`

```bash
cp backend/WorkoutOrganizer.Api/.env.example backend/WorkoutOrganizer.Api/.env   # preencha Jwt__Key
dotnet run --project backend/WorkoutOrganizer.Api
```

| Variável | Default | Para quê |
|---|---|---|
| `Jwt__Key` | — | obrigatória; base64 de ≥ 32 bytes aleatórios (a API recusa subir sem ela) |
| `DocumentService__BaseUrl` | `http://localhost:5200` | onde a API procura o document-service |

O `.env` é lido pelo `DotNetEnv` no `Program.cs`; cada linha `Secao__Chave` sobrescreve a chave
correspondente do `appsettings.json`, e variáveis de ambiente reais têm precedência sobre o arquivo.

- Scalar (documentação interativa, só em Development): <http://localhost:5199/scalar/v1>
- OpenAPI cru: <http://localhost:5199/openapi/v1.json>
- O caminho de `workout.db` é resolvido como `ContentRootPath/../../workout.db`, então roda de
  qualquer diretório — mas o repositório precisa estar íntegro.

### 2 · Frontend — `http://localhost:5173`

```bash
cd frontend
npm install
npm run dev
```

Aponta para a API via `frontend/.env` (`cp .env.example .env`; `VITE_API_URL=http://localhost:5199`).

### 3 · document-service — `http://localhost:5200` (só para a importação)

```bash
cd document-service
cp .env.example .env          # preencha OPENROUTER_API_KEY
pip install -r requirements.txt
python main.py
```

Sem ele, tudo funciona exceto **Importar ficha** — a API responde `503` nessa rota.

| Variável | Default | Para quê |
|---|---|---|
| `OPENROUTER_API_KEY` | — | obrigatória |
| `OPENROUTER_PRIMARY_MODEL` | `google/gemini-2.5-flash` | precisa ler ~15k tokens de catálogo e seguir instrução de correspondência |
| `OPENROUTER_FALLBACK_MODEL` | `openai/gpt-4o-mini` | acionado em 429 / 5xx / timeout / JSON inválido |
| `PORT` / `HOST` | `5200` / `0.0.0.0` | tem de bater com `DocumentService__BaseUrl` no `.env` da API |

### Reconstruir o banco (só quando o dataset ou o mapeamento mudar)

Nesta ordem — `build_database.py` apaga e reimporta as instruções do dataset, o que derrubaria
as traduções se elas morassem lá; por isso `build_translations.py` escreve em tabelas próprias
e roda **depois**. Todos são idempotentes.

```bash
python build_database.py          # exercises.json -> exercises, instructions, steps
python build_muscle_mapping.py    # muscle_term, muscle_mapping (heatmap)
python build_translations.py      # exercise_i18n, *_step_i18n, term_i18n
```

### Migrations (EF Core) — só tabelas de aplicação

```bash
cd backend/WorkoutOrganizer.Api
dotnet ef migrations add <Nome>
dotnet ef database update
```

---

## Verificando

**Não existe suíte de testes automatizados.** A verificação é esta:

```bash
dotnet build backend/WorkoutOrganizer.slnx   # compila a API (nullable habilitado)
cd frontend && npm run build                 # tsc -b + vite build: erro de tipo quebra aqui
cd frontend && npm run lint                  # oxlint (rules-of-hooks como erro)
```

Depois, o *smoke test* é manual: subir os serviços, logar no SPA e exercitar o fluxo tocado.
No Scalar, cole o `accessToken` de `POST /api/auth/login` no esquema Bearer para bater nas rotas
autenticadas. Consultar o banco direto é legítimo e barato:

```bash
python -c "import sqlite3;print(sqlite3.connect('workout.db').execute('select count(*) from workout_exercise').fetchone())"
```

Os arquivos em `tests/` (uma foto de ficha e um `.xlsx`) são **amostras** para testar a
importação à mão — não são testes automatizados.

---

## Estrutura do repositório

```
WorkoutOrganizer/
├── workout.db                  SQLite na raiz — fonte única, escrita pelo Python E pelo .NET
├── exercises.json              dataset original (1324 exercícios)
├── images/  videos/            mídia do dataset, servida pela API em /images e /videos
├── translations/               JSONs de tradução consumidos por build_translations.py
├── build_*.py                  ETL: dataset -> banco (idempotentes)
│
├── backend/
│   ├── API.md                  contrato rota a rota
│   └── WorkoutOrganizer.Api/
│       ├── Controllers/        Auth · Users · Workouts · Exercises · UserExercises
│       ├── Entities/  Data/    modelo EF + AppDbContext (dataset excluído de migrations)
│       ├── Migrations/         só workout, workout_exercise, completion, note
│       ├── Services/           TokenService · LocalizationService · DocumentServiceClient
│       └── Program.cs          JWT, CORS localhost, Scalar, static files
│
├── frontend/
│   ├── public/                 icon.png · Icon-noBg.png · favicon.png · logo.png
│   └── src/
│       ├── api/                um módulo por recurso da API
│       ├── pages/              Login · WorkoutsList · CreateWorkout · WorkoutView · Calendar · MuscleUse
│       ├── components/         BodyHeatmap · ExercisePicker · DocumentUploadDropzone · NoteSheet …
│       ├── i18n/               pt.ts (fonte) · en.ts (tipado a partir de pt)
│       └── lib/weekCycle.ts    a semana como janela de datas
│
├── document-service/
│   ├── main.py                 FastAPI: /health, /parse
│   ├── extractor.py            leitor por tipo de arquivo + chamada ao OpenRouter
│   └── catalog.py              catálogo em memória (lê workout.db em modo ro) + fuzzy
│
├── specs/                      decisões de produto e arquitetura — comece pelo INDEX.md
├── context.md                  histórico de como se chegou aqui
└── CLAUDE.md                   guia operacional do repositório
```

---

## Regras que não se quebram

Quatro. Tudo o mais é procedimento e mora em [`specs/INDEX.md`](specs/INDEX.md).

1. **Não cruze os donos do banco.** Tabela de dataset nunca ganha migration EF; tabela de
   aplicação nunca é criada em script Python. Alterar dataset a partir do .NET só via SQL manual
   dentro de uma migration, como foi feito para `user.refresh_token`.
2. **O `userId` vem sempre do token, nunca da requisição.** Isso já foi tentado ao contrário
   e revertido por permitir criar treino em nome de outro usuário.
3. **Identificador não se traduz.** `workout_exercise.dia`, `muscle_term.term`,
   `MuscleGroupOption.value` e os `muscleId` do SVG são chaves sob contrato — só texto de
   exibição passa por i18n.
4. **Mudança de comportamento começa por uma spec.** Feature ou alteração de contrato passa
   por `specs/` primeiro; bug, estilo e refactor sem mudança de contrato não precisam.

---

## Documentação

| Documento | O que tem |
|---|---|
| [`backend/API.md`](backend/API.md) | Contrato de cada rota: corpo, códigos de status, regras |
| [`specs/INDEX.md`](specs/INDEX.md) | Uma linha por decisão de produto (0001–0011), com status e divergências entre spec e implementação |
| [`context.md`](context.md) | Histórico: por que o modelo é assim, o que foi tentado e revertido |
| [`CLAUDE.md`](CLAUDE.md) | Guia operacional: rodar, testar, invariantes |
| [`exercises-dataset/README.md`](exercises-dataset/README.md) | Origem e licença do dataset de exercícios |

O dataset de exercícios é de terceiros — veja `exercises-dataset/LICENSE` e `NOTICE.md` antes
de redistribuir imagens ou vídeos.
