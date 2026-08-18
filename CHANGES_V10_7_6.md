# GENESIS V10.7.6 — endurecimento científico

- Bloqueio de comparação de expressão quando a escala reconhecida do caso (RPKM/TPM/FPKM/z-score) não corresponde à escala da coorte; escalas originais/não padronizadas nunca são assumidas equivalentes automaticamente.
- Campo de biomarcador renomeado para **mutação somática**, coerente com o perfil mutacional consultado.
- Idade unificada em todos os módulos com prioridade para `AGE_IN_DAYS`.
- WBC exige unidade do caso e é padronizado para ×10⁹/L; coortes sem unidade confirmável não usam WBC no pareamento.
- Síntese multicoorte exige replicação: uma única associação direcional entre várias coortes permanece inconclusiva.
- Contagem de “coortes com dados” agora considera disponibilidade real de expressão/mutação/fusão.
- Interface de seleção de coorte exibe capacidades e escala de expressão.
- Linguagem do modo R alterada para **modo compatível com referência R**; não há promessa de reprodução integral sem a matriz bruta original.
- Cache de datapacks incrementado para `DATA_VERSION = 11`.
- Nova bateria `scientific-hardening-v10-7-6.mjs`, incluindo integridade das 10 referências KM 46/46.
