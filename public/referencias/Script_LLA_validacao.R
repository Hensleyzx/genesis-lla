# ==============================================================================
# GENESIS LLA — PIPELINE DE VALIDAÇÃO DE PESQUISA
# Coorte padrão: TARGET ALL Phase II (cBioPortal)
# ==============================================================================
# FINALIDADE
#   Pipeline acadêmico/reprodutível para análises de coorte em LLA:
#   1) seleção de uma amostra BASAL por paciente (TARGET: 09 > 03)
#   2) top genes mutados com denominador de amostras perfiladas
#   3) DEA Relapse vs None usando expressão BASAL e log2(RPKM + 1)
#   4) Kaplan-Meier por expressão alta/baixa
#   5) Cox univariado com HR por 1 DP, FDR BH e diagnóstico PH por cox.zph
#
# NÃO é um modelo clínico validado e NÃO gera diagnóstico, prognóstico individual
# ou recomendação terapêutica. Os resultados descrevem associações na coorte.
# ==============================================================================

# ---- 0. Pacotes ---------------------------------------------------------------
if (!requireNamespace("BiocManager", quietly = TRUE)) install.packages("BiocManager")

bioc_pkgs <- c(
  "cBioPortalData", "limma", "MultiAssayExperiment", "SummarizedExperiment",
  "RaggedExperiment", "GenomicRanges", "org.Hs.eg.db", "AnnotationDbi"
)
cran_pkgs <- c(
  "tidyverse", "ggplot2", "ggrepel", "pheatmap", "survival", "survminer",
  "patchwork", "scales"
)

install_if_missing <- function(pkgs, bioc = FALSE) {
  miss <- pkgs[!pkgs %in% rownames(installed.packages())]
  if (length(miss)) {
    if (bioc) BiocManager::install(miss, ask = FALSE, update = FALSE)
    else install.packages(miss, quiet = TRUE)
  }
}
install_if_missing(cran_pkgs)
install_if_missing(bioc_pkgs, TRUE)

suppressPackageStartupMessages({
  library(cBioPortalData); library(MultiAssayExperiment); library(SummarizedExperiment)
  library(RaggedExperiment); library(GenomicRanges); library(org.Hs.eg.db)
  library(AnnotationDbi); library(limma); library(tidyverse); library(ggplot2)
  library(ggrepel); library(pheatmap); library(survival); library(survminer)
  library(patchwork); library(scales)
})

set.seed(42)
out <- "resultados_TARGET_ALL_validado/"
dir.create(out, showWarnings = FALSE, recursive = TRUE)

# ---- Funções auxiliares -------------------------------------------------------
na_strings <- c("NA", "[Not Available]", "[Not Applicable]", "[Unknown]", "", "N/A", "unknown")

norm_na <- function(x) {
  if (is.character(x)) x[x %in% na_strings] <- NA_character_
  x
}

get_col <- function(df, candidates) {
  hit <- intersect(candidates, names(df))
  if (length(hit)) hit[1] else NULL
}

# TARGET sample type: os últimos dois dígitos após o último hífen;
# suporta exemplos como -03, -09, -60.2, -60.11.
sample_type_code <- function(sample_id) {
  m <- stringr::str_match(sample_id, "-([0-9]{2})(?:[A-Za-z])?(?:\\..*)?$")
  m[, 2]
}

patient_id_from_sample <- function(sample_id) {
  stringr::str_remove(sample_id, "-[0-9]{2}(?:[A-Za-z])?(?:\\..*)?$")
}

parse_event <- function(x, event_pattern, censor_pattern = "LIVING|ALIVE|CENSORED|(^|:)0($|:)") {
  s <- toupper(trimws(as.character(x)))
  ifelse(
    is.na(s), NA_integer_,
    ifelse(str_detect(s, event_pattern), 1L,
           ifelse(str_detect(s, censor_pattern), 0L, NA_integer_))
  )
}

fmt_p <- function(x) ifelse(is.na(x), NA_character_, format.pval(x, digits = 3, eps = 1e-4))

# ---- 1. Estudo LLA ------------------------------------------------------------
message("Conectando ao cBioPortal...")
cbio <- cBioPortal()
all_studies <- getStudies(cbio)

# Filtro intencionalmente restritivo: LLA/ALL, excluindo AML.
lla_studies <- all_studies %>%
  filter(
    !str_detect(paste(studyId, name), regex("acute myeloid|\\bAML\\b", ignore_case = TRUE)),
    str_detect(
      paste(studyId, name),
      regex("acute lymphoblastic|acute lymphoid|lymphoblastic leukemia|\\bB-ALL\\b|\\bT-ALL\\b|^all_", ignore_case = TRUE)
    )
  ) %>%
  dplyr::select(studyId, name, allSampleCount)

print(lla_studies)
study_id <- "all_phase2_target_2018_pub"
if (!study_id %in% all_studies$studyId) stop("Estudo padrão TARGET ALL não encontrado no catálogo atual.")

message("Baixando: ", study_id)
mae <- cBioDataPack(study_id, ask = FALSE)
exp_names <- names(experiments(mae))
message("Experimentos: ", paste(exp_names, collapse = ", "))

# ---- 2. Dados clínicos em nível de paciente ----------------------------------
clinical_raw <- as.data.frame(colData(mae))
clinical_raw <- clinical_raw %>% mutate(across(everything(), norm_na))

# O pacote pode conter várias linhas/amostras do mesmo paciente.
# PATIENT_ID é preferido; caso ausente, o ID é derivado do rowname/sample ID.
if ("PATIENT_ID" %in% names(clinical_raw)) {
  clinical_raw$patient_id <- as.character(clinical_raw$PATIENT_ID)
} else {
  clinical_raw$patient_id <- patient_id_from_sample(rownames(clinical_raw))
}

clinical_patient <- clinical_raw %>%
  filter(!is.na(patient_id), patient_id != "") %>%
  group_by(patient_id) %>%
  slice(1) %>%
  ungroup() %>%
  as.data.frame()
rownames(clinical_patient) <- clinical_patient$patient_id

# Endpoint de sobrevida desta versão: SOMENTE Overall Survival (OS).
# Não há fallback para EFS/DFS e não há mistura paciente-a-paciente entre colunas.
os_time_col  <- get_col(clinical_patient, c("OS_MONTHS", "OVERALL_SURVIVAL_MONTHS", "OS_DAYS"))
os_event_col <- get_col(clinical_patient, c("OS_STATUS", "VITAL_STATUS"))

make_time_months <- function(df, col) {
  x <- suppressWarnings(as.numeric(df[[col]]))
  if (str_detect(col, "DAYS")) x / 30.4375 else x
}

clinical_patient$os_time <- if (!is.null(os_time_col)) make_time_months(clinical_patient, os_time_col) else NA_real_
clinical_patient$os_event <- if (!is.null(os_event_col)) parse_event(
  clinical_patient[[os_event_col]],
  "DECEASED|DEAD|DIED|(^|:)1($|:)",
  "LIVING|ALIVE|CENSORED|(^|:)0($|:)"
) else NA_integer_

write.csv(clinical_patient, paste0(out, "clinical_patient_level.csv"), row.names = FALSE)

# ---- 3. Matriz de expressão + seleção BASAL ----------------------------------
rna_exp_name <- "mrna_seq_rpkm"
if (!rna_exp_name %in% exp_names) {
  idx <- which(str_detect(tolower(exp_names), "rna_seq|rnaseq|rpkm|tpm|fpkm"))
  if (!length(idx)) stop("Experimento de expressão RNA não encontrado.")
  rna_exp_name <- exp_names[idx[1]]
}
rna_exp <- experiments(mae)[[rna_exp_name]]
expr_raw <- assay(rna_exp)

# Filtragem de qualidade mínima, antes da transformação.
expr_raw <- expr_raw[rowSums(!is.na(expr_raw)) >= ncol(expr_raw) * 0.70, , drop = FALSE]
expr_raw <- expr_raw[apply(expr_raw, 1, var, na.rm = TRUE) > 0, , drop = FALSE]
expr_raw <- t(apply(expr_raw, 1, function(x) {
  x[is.na(x)] <- median(x, na.rm = TRUE)
  x
}))

# Entrez -> HUGO
entrez_ids <- rownames(expr_raw)
mapa <- AnnotationDbi::select(
  org.Hs.eg.db, keys = entrez_ids, columns = c("ENTREZID", "SYMBOL"), keytype = "ENTREZID"
) %>% filter(!is.na(SYMBOL)) %>% distinct(ENTREZID, .keep_all = TRUE)
keep <- rownames(expr_raw) %in% mapa$ENTREZID
expr_sym <- expr_raw[keep, , drop = FALSE]
rownames(expr_sym) <- mapa$SYMBOL[match(rownames(expr_sym), mapa$ENTREZID)]
# Em símbolos duplicados, preserva a linha de maior variância.
vars <- apply(expr_sym, 1, var, na.rm = TRUE)
expr_sym <- expr_sym[order(vars, decreasing = TRUE), , drop = FALSE]
expr_sym <- expr_sym[!duplicated(rownames(expr_sym)), , drop = FALSE]

sample_map <- tibble(
  sample_id = colnames(expr_sym),
  patient_id = patient_id_from_sample(colnames(expr_sym)),
  sample_type = sample_type_code(colnames(expr_sym))
) %>% filter(patient_id %in% clinical_patient$patient_id)

# Uma amostra primária por paciente: 09 (medula óssea) > 03 (sangue periférico).
# Recaída (04/40), xen enxerto (60/61) e normais (10/11/14) não entram na
# análise prognóstica basal.
baseline_map <- sample_map %>%
  filter(sample_type %in% c("09", "03")) %>%
  mutate(priority = ifelse(sample_type == "09", 1L, 2L)) %>%
  arrange(patient_id, priority, sample_id) %>%
  group_by(patient_id) %>% slice(1) %>% ungroup()

if (nrow(baseline_map) < 20) stop("Poucas amostras basais 09/03 disponíveis para análise.")
message("Amostras basais selecionadas: ", nrow(baseline_map))
print(table(baseline_map$sample_type))
write.csv(baseline_map, paste0(out, "baseline_sample_selection.csv"), row.names = FALSE)

expr_baseline_rpkm <- expr_sym[, baseline_map$sample_id, drop = FALSE]
# CORREÇÃO PRINCIPAL: RPKM não é tratado como log2FC bruto.
expr_baseline_log2 <- log2(pmax(expr_baseline_rpkm, 0) + 1)

# Tabela de referência de expressão na escala analítica.
expr_reference <- tibble(
  gene = rownames(expr_baseline_log2),
  n = apply(expr_baseline_log2, 1, function(x) sum(is.finite(x))),
  mean_log2 = rowMeans(expr_baseline_log2, na.rm = TRUE),
  median_log2 = apply(expr_baseline_log2, 1, median, na.rm = TRUE),
  q25_log2 = apply(expr_baseline_log2, 1, quantile, .25, na.rm = TRUE),
  q75_log2 = apply(expr_baseline_log2, 1, quantile, .75, na.rm = TRUE)
)
write.csv(expr_reference, paste0(out, "gene_expression_reference_log2.csv"), row.names = FALSE)

# ---- 4. Mutações --------------------------------------------------------------
# Política do Top 30 oficial do projeto:
#   - usa o case list mutacional completo do estudo (todas as amostras perfiladas);
#   - TARGET ALL possui n=150 amostras com perfil de mutação no conjunto usado
#     para a figura de referência fornecida pelo projeto;
#   - NÃO reaplica o filtro basal 09/03 aqui. Esse filtro permanece restrito às
#     análises que dependem de uma amostra basal por paciente (expressão/OS).
# Isso evita misturar o denominador n=81 da coorte basal com o Top 30 R n=150.
top30_genes <- NULL
mut_idx <- which(str_detect(tolower(exp_names), "mutation|mut|maf|snp|variant"))
if (length(mut_idx)) {
  mut_exp <- experiments(mae)[[mut_idx[1]]]
  mut_assay <- sparseAssay(mut_exp)
  mut_bin <- (!is.na(mut_assay)) * 1L

  denom_mut <- ncol(mut_bin)
  top30_genes <- tibble(
    Gene = rownames(mut_bin),
    n_amostras = rowSums(mut_bin, na.rm = TRUE)
  ) %>%
    group_by(Gene) %>%
    summarise(n_amostras = sum(n_amostras), .groups = "drop") %>%
    mutate(freq_relativa = round(100 * n_amostras / denom_mut, 1)) %>%
    arrange(desc(n_amostras)) %>% head(30)

  write.csv(top30_genes, paste0(out, "top30_genes_mutados.csv"), row.names = FALSE)

  p_mut <- top30_genes %>%
    arrange(freq_relativa) %>%
    mutate(Gene = factor(Gene, levels = Gene)) %>%
    ggplot(aes(Gene, freq_relativa, fill = freq_relativa)) +
    geom_col(color = "gray20", linewidth = 0.3) +
    geom_text(aes(label = paste0(freq_relativa, "%")),
              hjust = -0.1, size = 3.2, color = "gray20") +
    coord_flip() +
    scale_fill_gradient(low = "#fef0d9", high = "#d7301f", name = "Freq. (%)") +
    scale_y_continuous(expand = expansion(mult = c(0, 0.15))) +
    labs(
      title = "Top 30 Genes Mais Mutados/Alterados",
      subtitle = paste0("Leucemia Linfoide Aguda — TARGET ALL (n=", denom_mut, " amostras)"),
      x = NULL,
      y = "Frequência de Mutação (%)"
    ) +
    theme_classic(base_size = 12)

  ggsave(paste0(out, "fig1_top30_genes.png"), p_mut,
         width = 10, height = 10, dpi = 300, bg = "white")
}

# ---- 5. DEA BASAL: futuro Relapse vs None ------------------------------------
clinical_for_expr <- clinical_patient[baseline_map$patient_id, , drop = FALSE]
rownames(clinical_for_expr) <- baseline_map$sample_id
first_event <- as.character(clinical_for_expr$FIRST_EVENT)
keep_dea <- first_event %in% c("Relapse", "None")
expr_dea <- expr_baseline_log2[, keep_dea, drop = FALSE]
groups <- factor(first_event[keep_dea], levels = c("None", "Relapse"))
if (sum(groups == "None") < 3 || sum(groups == "Relapse") < 3) stop("Grupos Relapse/None insuficientes para DEA.")

# Em valores contínuos log2(RPKM+1), usa-se limma com trend=TRUE.
design <- model.matrix(~0 + groups)
colnames(design) <- levels(groups)
contrast <- makeContrasts(Relapse - None, levels = design)
fit <- lmFit(expr_dea, design)
fit <- contrasts.fit(fit, contrast)
fit <- eBayes(fit, trend = TRUE)

dea <- topTable(fit, coef = 1, number = Inf, sort.by = "P") %>%
  rownames_to_column("gene") %>%
  mutate(
    signif = case_when(
      adj.P.Val < 0.01 & logFC >  1.0 ~ "Up — Alta",
      adj.P.Val < 0.01 & logFC < -1.0 ~ "Down — Alta",
      adj.P.Val < 0.05 & logFC >  0.5 ~ "Up — Moderada",
      adj.P.Val < 0.05 & logFC < -0.5 ~ "Down — Moderada",
      TRUE ~ "NS"
    ),
    color_grp = case_when(str_detect(signif,"Up")~"Upregulado",str_detect(signif,"Down")~"Downregulado",TRUE~"NS")
  )
write.csv(dea, paste0(out,"DEA_baseline_relapse_vs_none.csv"), row.names=FALSE)

volcano_labels <- dea %>% filter(signif != "NS") %>% arrange(adj.P.Val) %>% head(20)
p_volcano <- ggplot(dea, aes(logFC, -log10(pmax(adj.P.Val, 1e-300)), color=color_grp)) +
  geom_point(alpha=.5,size=1.7) +
  geom_vline(xintercept=c(-.5,.5),linetype="dashed",color="gray50") +
  geom_hline(yintercept=-log10(.05),linetype="dashed",color="gray50") +
  geom_label_repel(data=volcano_labels,aes(label=gene),size=2.7,max.overlaps=20) +
  scale_color_manual(values=c(Upregulado="#c0392b",Downregulado="#2980b9",NS="gray75")) +
  labs(title="DEA basal — Relapse vs None",subtitle="TARGET ALL · log2(RPKM + 1) · limma-trend",x="log2 Fold Change",y="-log10(FDR)",color=NULL) +
  theme_classic(base_size=12)
ggsave(paste0(out,"fig2_volcano_DEA_baseline.png"),p_volcano,width=9,height=7,dpi=300,bg="white")

# ---- 6. Endpoint único para KM/Cox: OS somente -------------------------------
os_ok <- is.finite(clinical_for_expr$os_time) & !is.na(clinical_for_expr$os_event) & clinical_for_expr$os_time > 0
if (sum(os_ok) < 20 || sum(clinical_for_expr$os_event[os_ok], na.rm=TRUE) < 5) {
  stop("Overall Survival (OS) insuficiente para KM/Cox: são exigidos >=20 registros válidos e >=5 eventos. Não há fallback para EFS/DFS.")
}
surv_time <- clinical_for_expr$os_time
surv_event <- clinical_for_expr$os_event
endpoint <- "OS"
endpoint_label <- "Sobrevida Global (OS)"

surv_cohort <- tibble(
  sample_id = baseline_map$sample_id,
  patient_id = baseline_map$patient_id,
  time_months = surv_time,
  event = surv_event,
  endpoint = endpoint,
  FIRST_EVENT = first_event
) %>% filter(is.finite(time_months), !is.na(event), time_months > 0)
write.csv(surv_cohort, paste0(out,"survival_baseline_cohort.csv"), row.names=FALSE)

# ---- 7. Genes candidatos: DEA + mutação (sem truncar antes da união) ----------
dea_candidates <- dea %>% filter(signif != "NS") %>% arrange(adj.P.Val) %>% head(10) %>% pull(gene)
mut_candidates <- if (!is.null(top30_genes)) head(top30_genes$Gene,10) else character(0)
km_candidates <- unique(c(dea_candidates, mut_candidates))
km_candidates <- km_candidates[km_candidates %in% rownames(expr_baseline_log2)]
if (length(km_candidates) > 20) km_candidates <- km_candidates[1:20]
message("Genes candidatos KM/Cox: ", paste(km_candidates, collapse=", "))

# ---- 8. Kaplan-Meier ----------------------------------------------------------
km_summary <- list()
km_plots <- list()
for (gene in km_candidates) {
  x <- as.numeric(expr_baseline_log2[gene, ])
  df <- tibble(time=surv_time,event=surv_event,expr=x) %>% filter(is.finite(time),!is.na(event),time>0,is.finite(expr))
  if (nrow(df) < 20 || sum(df$event) < 5) next
  cut <- median(df$expr,na.rm=TRUE)
  df$grupo <- factor(ifelse(df$expr >= cut,"Alto","Baixo"),levels=c("Baixo","Alto"))
  if (min(table(df$grupo)) < 5) next
  fit_km <- survfit(Surv(time,event)~grupo,data=df)
  lr <- survdiff(Surv(time,event)~grupo,data=df)
  p_lr <- pchisq(lr$chisq,df=length(lr$n)-1,lower.tail=FALSE)
  km_summary[[gene]] <- tibble(gene=gene,endpoint=endpoint,median_cut_log2=cut,n=nrow(df),events=sum(df$event),n_low=sum(df$grupo=="Baixo"),n_high=sum(df$grupo=="Alto"),logrank_p=p_lr)
  p <- ggsurvplot(fit_km,data=df,pval=TRUE,conf.int=TRUE,risk.table=TRUE,risk.table.height=.28,
                  palette=c("#2980b9","#c0392b"),title=paste0("KM — ",gene," (",endpoint,")"),
                  xlab="Tempo (meses)",ylab="Probabilidade de sobrevida",ggtheme=theme_classic(base_size=12))
  km_plots[[gene]] <- p
  png(paste0(out,"fig_KM_",gene,".png"),width=2200,height=2000,res=300); print(p); dev.off()
}
km_summary_df <- bind_rows(km_summary)
if (nrow(km_summary_df)) {
  km_summary_df$logrank_FDR <- p.adjust(km_summary_df$logrank_p, method="BH")
  write.csv(km_summary_df,paste0(out,"kaplan_meier_summary.csv"),row.names=FALSE)
}

# ---- 9. Cox univariado + FDR + proporcionalidade dos riscos ------------------
cox_rows <- list()
for (gene in km_candidates) {
  x <- as.numeric(expr_baseline_log2[gene, ])
  df <- tibble(time=surv_time,event=surv_event,expr=x) %>% filter(is.finite(time),!is.na(event),time>0,is.finite(expr))
  if (nrow(df) < 20 || sum(df$event) < 5 || sd(df$expr) == 0) next
  df$expr_z <- as.numeric(scale(df$expr))
  fit_c <- tryCatch(coxph(Surv(time,event)~expr_z,data=df,ties="efron",x=TRUE),error=function(e) NULL)
  if (is.null(fit_c)) next
  s <- summary(fit_c)
  ph <- tryCatch(cox.zph(fit_c, transform="km"),error=function(e) NULL)
  ph_p <- if (!is.null(ph)) as.numeric(ph$table["expr_z","p"]) else NA_real_
  cox_rows[[gene]] <- tibble(
    Gene=gene,n=nrow(df),events=sum(df$event),HR=exp(coef(fit_c)[1]),
    HR_lower=s$conf.int[1,"lower .95"],HR_upper=s$conf.int[1,"upper .95"],
    p_value=s$coefficients[1,"Pr(>|z|)"],PH_p_value=ph_p,concordance=as.numeric(s$concordance[1])
  )
}
cox_uni <- bind_rows(cox_rows)
if (nrow(cox_uni)) {
  cox_uni <- cox_uni %>% mutate(FDR=p.adjust(p_value,method="BH"),PH_ok=is.na(PH_p_value)|PH_p_value>=.05) %>% arrange(FDR)
  write.csv(cox_uni,paste0(out,"cox_univariado_validado.csv"),row.names=FALSE)

  p_forest <- cox_uni %>% mutate(Gene=reorder(Gene,HR)) %>%
    ggplot(aes(HR,Gene)) + geom_vline(xintercept=1,linetype="dashed",color="gray50") +
    geom_errorbar(aes(xmin=HR_lower,xmax=HR_upper),orientation="y",height=.22,color="gray35") +
    geom_point(aes(color=FDR<.05 & PH_ok),size=3) +
    scale_color_manual(values=c(`TRUE`="#c0392b",`FALSE`="#8590a8"),labels=c(`TRUE`="FDR<0,05 + PH adequado",`FALSE`="Não passou filtro")) +
    labs(title="Forest Plot — Cox univariado",subtitle=paste0(endpoint_label," · HR por 1 DP de expressão"),x="Hazard Ratio (IC95%)",y=NULL,color=NULL) +
    theme_classic(base_size=12)
  ggsave(paste0(out,"fig_forest_cox_validado.png"),p_forest,width=10,height=6,dpi=300,bg="white")
}

# ---- 10. Cox multivariado com proteção contra sobreajuste --------------------
# Regra conservadora de pesquisa: no máximo 1 variável para ~10 eventos e máx. 5.
if (exists("cox_uni") && nrow(cox_uni)) {
  n_events <- sum(surv_event,na.rm=TRUE)
  max_vars <- max(0,min(5,floor(n_events/10)))
  multi_genes <- cox_uni %>% filter(FDR<.10, PH_ok) %>% arrange(FDR) %>% head(max_vars) %>% pull(Gene)
  if (length(multi_genes)>=2) {
    mat <- t(expr_baseline_log2[multi_genes,,drop=FALSE]) %>% as.data.frame()
    mat$time <- surv_time; mat$event <- surv_event
    mat <- mat %>% filter(is.finite(time),!is.na(event),time>0) %>% drop_na(all_of(multi_genes))
    mat[multi_genes] <- lapply(mat[multi_genes],function(x) as.numeric(scale(x)))
    f <- as.formula(paste0("Surv(time,event) ~ ",paste(sprintf("`%s`",multi_genes),collapse=" + ")))
    fit_multi <- coxph(f,data=mat,ties="efron",x=TRUE)
    sm <- summary(fit_multi)
    multi <- tibble(Gene=rownames(sm$coefficients),HR=sm$conf.int[,"exp(coef)"],HR_lower=sm$conf.int[,"lower .95"],HR_upper=sm$conf.int[,"upper .95"],p_value=sm$coefficients[,"Pr(>|z|)"])
    multi$FDR <- p.adjust(multi$p_value,method="BH")
    phm <- tryCatch(cox.zph(fit_multi),error=function(e) NULL)
    if (!is.null(phm)) multi$PH_global_p <- as.numeric(phm$table["GLOBAL","p"])
    write.csv(multi,paste0(out,"cox_multivariado_guardado.csv"),row.names=FALSE)
  }
}

# ---- 11. Resumo de fusões clínicas -------------------------------------------
fusion_cols <- intersect(c("BCR_ABL1_STATUS","ETV6_RUNX1_FUSION_STATUS","MLL_STATUS","TCF3_PBX1_STATUS"),names(clinical_patient))
if (length(fusion_cols)) {
  fusion_summary <- map_dfr(fusion_cols,function(col){x=clinical_patient[[col]];ok=!is.na(x)&x!="";pos=str_detect(toupper(as.character(x)),"POSITIVE|PRESENT|DETECTED|YES");tibble(feature=col,n_available=sum(ok),n_positive=sum(pos&ok),frequency_positive=ifelse(sum(ok)>0,100*sum(pos&ok)/sum(ok),NA_real_))})
  write.csv(fusion_summary,paste0(out,"fusion_status_summary.csv"),row.names=FALSE)
}

# ---- 12. Metadados/reprodutibilidade -----------------------------------------
meta <- tibble(
  study_id=study_id,
  expression_profile=rna_exp_name,
  expression_scale_input="RPKM",
  expression_scale_analysis="log2(RPKM + 1)",
  baseline_rule="TARGET sample type 09 > 03; exclude relapse/xenograft/normal",
  endpoint=endpoint,
  n_baseline=nrow(baseline_map),
  n_survival=sum(is.finite(surv_time)&!is.na(surv_event)&surv_time>0),
  n_events=sum(surv_event,na.rm=TRUE),
  dea_none=sum(groups=="None"),
  dea_relapse=sum(groups=="Relapse"),
  generated_at=as.character(Sys.time()),
  R_version=R.version.string
)
write.csv(meta,paste0(out,"analysis_metadata.csv"),row.names=FALSE)

message("\nGENESIS LLA — pipeline concluído.")
message("Saídas: ",normalizePath(out))
message("IMPORTANTE: resultados de coorte/pesquisa; não usar como diagnóstico ou prognóstico individual.")
