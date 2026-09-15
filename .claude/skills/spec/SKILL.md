---
name: spec
description: Escrever, numerar, revisar ou mudar o status de uma spec em specs/ deste projeto (WorkoutOrganizer). Use ao propor uma feature ou mudança de comportamento, ao pedir "cria uma spec para X", ao implementar uma spec existente, ou ao marcar uma spec como implementada/substituída. Contém a numeração, o frontmatter obrigatório, o ciclo de status e a regra do INDEX.md.
---

# Procedimento de spec

Uma spec por pasta numerada: `specs/000N-slug/spec.md`. Nada de arquivo único —
o objetivo é diff legível, histórico preservado e contexto carregado só quando
o assunto aparece.

## 1. Antes de escrever: verificar o terreno

Spec deste projeto afirma fatos, não intenções. Antes da primeira linha:

- ler o [`specs/INDEX.md`](../../../specs/INDEX.md) inteiro e as specs relacionadas (só essas);
- conferir o schema real: `python -c "import sqlite3;print([r[0] for r in sqlite3.connect('workout.db').execute(\"select name from sqlite_master where type='table'\")])"`;
- conferir contagens que a spec for citar (`select count(*) ...`) em vez de estimar;
- conferir as rotas existentes em [`backend/API.md`](../../../backend/API.md) e o código que a spec vai tocar.

Cada número citado na spec deve ter vindo de uma dessas consultas.

## 2. Criar a pasta

O número é o maior `id` existente em `specs/` **+1**, com quatro dígitos, e nunca
é reciclado — nem quando uma spec é abandonada. O slug é curto, em minúsculas,
sem a palavra "spec", em português: `0007-remover-exercicio-do-treino`.

Copiar [`specs/TEMPLATE.md`](../../../specs/TEMPLATE.md) para `specs/000N-slug/spec.md` e preencher.
Seções que não se aplicam saem do arquivo; nenhuma seção nova entra sem motivo.
Artefatos de apoio da spec (SQL de ensaio, mockup, medição) ficam na mesma pasta,
ao lado do `spec.md`.

## 3. Frontmatter obrigatório

```yaml
---
id: 0007                      # igual ao número da pasta, quatro dígitos
title: Remover exercício do treino
status: draft                 # draft | approved | implemented | superseded
created: 2026-09-10           # data real de criação, absoluta
areas: [backend, frontend]    # subconjunto de: data, backend, frontend
supersedes: []                # ids que esta spec substitui, ex: [0003]
superseded_by: null           # id que substituiu esta, quando status: superseded
---
```

## 4. Links

Sempre relativos, a partir da pasta da spec:

- para o código: `../../frontend/src/pages/WorkoutViewPage.tsx`, com `#L32` quando a linha importa;
- para outra spec: `../0005-excluir-treino/spec.md`;
- nunca link absoluto, nunca caminho `C:\...`.

## 5. Ciclo de status

| De | Para | Quando |
| --- | --- | --- |
| — | `draft` | a spec foi escrita e ainda está em discussão |
| `draft` | `approved` | o usuário decidiu; é o contrato a implementar |
| `approved` | `implemented` | o código está no repositório e a §7 (ordem de execução) terminou |
| qualquer | `superseded` | outra spec substituiu a decisão |

Mudar de status é editar **dois** arquivos: o frontmatter da spec e a linha dela
no `INDEX.md`. Nunca só um.

**Spec `superseded` não se apaga e não se reescreve.** Preenche-se
`superseded_by: 000M`, a spec nova recebe `supersedes: [000N]`, e a linha do
índice muda de status. O histórico da decisão anterior é o que explica a nova.

## 6. INDEX.md

Uma linha por spec, na ordem numérica, com a coluna "O que decide" resumindo a
**decisão** — não o tema. "A conclusão pertence à data, não ao dia da semana" é
uma decisão; "sistema de conclusão" é um tema e não serve.

Criar uma spec sem adicionar a linha no índice deixa o índice mentiroso, que é o
único jeito de esse esquema falhar. É a última etapa de toda alteração em `specs/`.

## 7. Implementar uma spec

A §7 da spec (ordem de execução) é a lista de tarefas — seguir na ordem, cada
item verificável isolado. Ao terminar:

1. `dotnet build backend/WorkoutOrganizer.slnx` e, no `frontend/`, `npm run build` + `npm run lint`;
2. atualizar [`backend/API.md`](../../../backend/API.md) se alguma rota mudou;
3. `status: implemented` no frontmatter **e** no `INDEX.md`;
4. se a implementação divergiu da spec, corrigir a spec para descrever o que foi
   feito e por quê — spec desatualizada é pior que spec ausente.

Divergência descoberta no meio da implementação é motivo para parar e perguntar,
não para improvisar: a spec é o contrato acordado.
