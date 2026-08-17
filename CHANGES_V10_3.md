# GENESIS LLA V10.3 — auditoria de continuidade

## Correções científicas

- Política de sobrevida unificada em **OS somente** no JavaScript e no R; removido fallback para EFS/DFS.
- Valores de status clínico desconhecidos/ausentes passam a ser excluídos, não censurados automaticamente.
- Proteções por gene alinhadas ao Script.R: KM/Cox exigem `n >= 20` e `eventos >= 5`; KM exige `min(grupo) >= 5`; Cox exige variância e convergência.
- Valores `null` de expressão deixam de ser convertidos em zero.
- Seleção mutacional TARGET não volta para todas as amostras quando nenhuma basal válida é encontrada.
- `DATA_VERSION` elevado para 7 para evitar cache legado contaminando uma nova execução.

## Paridade e auditoria visual

- Kaplan–Meier agora desenha IC95% log-log/Greenwood.
- Adicionado gráfico de eventos observados × esperados do mesmo log-rank.
- Adicionada exportação JSON dos pontos KM, IC95%, censuras, risco e estatística log-rank.
- Forest Plot de Cox ganhou tabela com HR, IC95%, p, FDR BH, N e eventos.
- Tempos da tabela “número em risco” agora respeitam o seguimento real do gene, sem forçar 50/100/150 meses.

## Publicação

- `vite.config.ts` não depende mais do nome fixo `genesis-lla`; em GitHub Actions o `base` deriva de `GITHUB_REPOSITORY`.
- O workflow executa `npm run test:science` antes do build/deploy.
