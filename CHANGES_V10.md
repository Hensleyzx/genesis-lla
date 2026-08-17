# GENESIS V10 — revisão solicitada pelo professor

## Fluxo
- `Nova Análise Molecular` foi substituída por **Cadastros** (paciente e profissional).
- **Resultados** centraliza carregamento do estudo, seleção de genes e escolha dos gráficos.
- A antiga **Bioinformática** saiu do menu e redireciona para Resultados.
- **Dashboard** virou histórico dos gráficos solicitados; não executa tudo automaticamente.
- **Sobre o Projeto** mantém objetivo, fluxo, limitações e autores.

## Genes
- O Top 10 é atualizado a partir dos 10 primeiros genes do Top 30 de mutações do estudo ativo.
- É possível escolher 1, vários ou adicionar outro gene fora do Top 10.
- Forest Plot e Kaplan-Meier usam somente os genes selecionados pelo usuário.

## Validação
- O site mostra explicitamente que, nesta etapa, somente o Top 30 TARGET ALL n=150 está validado numericamente contra uma saída R fornecida.
- Resultados produzidos a partir do estudo ativo no navegador são marcados como **exploratórios** até comparação com uma saída R da mesma coorte, mesmos filtros e mesmos genes.
- O Top 30 n=150 e um Top 30 de coorte basal n=81 não são tratados como a mesma execução.
- O Volcano antigo com log2FC em escala de milhares é marcado como legado/metodologicamente incompatível com log2FC; não é reproduzido como resultado final.
