# AgentX

CLI para automação de tarefas com integração de IA (Gemini, OpenAI), GitHub, Azure DevOps, AWS e renderização de Markdown no terminal.

## Pré requisito
Instale o bun
```bash
curl -fsSL https://bun.sh/install | bash
```

## Instalação das dependencias
```bash
bun install
```

## Run Dev
```bash
bun run ./src/index.js run "Liste meus GitHub repositories"
```

## Build
```bash
bun run build
```

## Task
- Favoritos web
- Template build projects
- Google drive
- Spotify

Exemplo:

Isso funciona
/Users/renatoadorno/work/agent-x/dist/agent-macos-arm64 run "me de um exemplo de query mysql para criar um tabela" -g

Mas isso nao
/Users/renatoadorno/cli/agent-macos-arm64 run "me de um exemplo de query mysql para criar um tabela” -g
