# GENESIS LLA — Exemplo para o Laboratório R (WebR)
#
# Na página Bioinformática, depois de importar um CSV/TSV manual,
# o GENESIS disponibiliza uma cópia normalizada em:
#   /data/genesis_input.csv
#
# Este exemplo usa apenas funções de base R para maximizar a
# compatibilidade com execução dentro do navegador.

arquivo <- "/data/genesis_input.csv"

if (file.exists(arquivo)) {
  dados <- read.csv(
    arquivo,
    check.names = FALSE,
    stringsAsFactors = FALSE
  )

  cat("GENESIS — arquivo manual carregado\n")
  cat("Linhas:", nrow(dados), "\n")
  cat("Colunas:", ncol(dados), "\n\n")

  cat("Nomes das colunas:\n")
  print(names(dados))

  cat("\nPrimeiras linhas:\n")
  print(head(dados, 6))

  # Exemplo: tabela de expressão diferencial exportada pelo pipeline GENESIS.
  if (all(c("gene", "logFC", "adj.P.Val") %in% names(dados))) {
    dados$significativo <- (
      !is.na(dados$adj.P.Val) &
      !is.na(dados$logFC) &
      dados$adj.P.Val < 0.05 &
      abs(dados$logFC) > 0.5
    )

    efeitos <- abs(dados$logFC[is.finite(dados$logFC)])
    escala_suspeita <- length(efeitos) > 0 && (max(efeitos) > 50 || unname(quantile(efeitos, .99)) > 25)

    if (escala_suspeita) {
      cat("\nATENÇÃO: a coluna logFC possui amplitudes incompatíveis com log2FC típico.\n")
      cat("O GENESIS não gera Top DEGs/Volcano desse arquivo como se fosse log2FC.\n")
      cat("Recalcule a DEA a partir da matriz de expressão transformada (ex.: log2(RPKM+1)).\n")
    } else {
      cat("\nDEGs significativos:", sum(dados$significativo), "\n")

      top <- dados[
        order(dados$adj.P.Val),
        c("gene", "logFC", "adj.P.Val")
      ]

      cat("\nTop 10 por FDR:\n")
      print(head(top, 10))

      # Gráfico simples compatível com WebR.
      top_plot <- head(top[is.finite(top$logFC), ], 15)
      if (nrow(top_plot) > 0) {
        par(mar = c(5, 9, 3, 1))
        barplot(
          rev(top_plot$logFC),
          names.arg = rev(top_plot$gene),
          horiz = TRUE,
          las = 1,
          main = "Top DEGs — arquivo importado",
          xlab = "log2 Fold Change"
        )
        abline(v = 0, lty = 2)
      }
    }
  }

} else {
  cat("Nenhum CSV/TSV foi sincronizado com o Laboratório R.\n")
  cat("Importe um arquivo na página Bioinformática e execute novamente.\n\n")

  # Demonstração mínima de que o runtime R está funcionando.
  set.seed(42)
  x <- rnorm(100)

  cat("Média:", mean(x), "\n")
  cat("Desvio-padrão:", sd(x), "\n")

  hist(
    x,
    main = "Teste do WebR no GENESIS",
    xlab = "Valor"
  )
}
