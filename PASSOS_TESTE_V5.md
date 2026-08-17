# Passos de teste — GENESIS V5

1. Abra o terminal dentro da pasta `GENESIS_LLA_V5`.
2. Rode `npm install`.
3. Rode `npm run build`. O build precisa terminar com `✓ built` antes de publicar.
4. Rode `npm run dev`.
5. Em **Bioinformática**:
   - carregue TARGET ALL no modo Expresso;
   - carregue pelo menos mais um estudo;
   - marque 2 estudos em **Estudos carregados — comparação simultânea**;
   - confira a tabela multicoorte e o índice de qualidade técnica;
   - teste **Carregar os 5 (Expresso)** se houver tempo/rede.
6. Importe o arquivo DEA legado. A V5 deve detectar a escala incompatível e NÃO desenhar o gráfico como log2FC.
7. Carregue um estudo e confira os gráficos corretos gerados a partir da expressão da API: Top DEGs, Volcano, Forest Plot e Top Mutações.
8. Em **Análise**:
   - confira os 10 genes iniciais;
   - adicione um gene personalizado como `CRLF2` ou `JAK2`;
   - selecione os genes desejados e conclua a análise;
   - confira a qualidade técnica da coorte e a confiabilidade técnica por evidência.
9. No **R Lab**, use `Exemplo_WebR.R`. O exemplo também bloqueia a interpretação de DEA com escala incompatível.

> Os índices de qualidade/confiabilidade são indicadores técnicos de completude e suporte estatístico. Não são acurácia diagnóstica, probabilidade de sobrevida ou validação clínica.
