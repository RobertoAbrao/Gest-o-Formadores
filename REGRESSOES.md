# Verificações manuais antes do merge

O que não dá (ainda) para testar automaticamente. **Esta trava é manual, portanto mais
fraca**: reconfira estes itens antes de todo merge que mexa na área indicada. Quando der
para automatizar, automatize e tire daqui.

## Anexo de imagem em etapa de projeto (caso Sumaré, 25/11/2026)

**Área:** `src/lib/anexos/reduzir-imagem-navegador.ts` e o upload em
`src/components/projetos/form-projeto.tsx`.

**Por que é manual:** a redução usa `<img>` + `canvas`, que só existem no navegador. A regra
de quando e quanto reduzir é testada (`src/lib/anexos/preparar-arquivo.test.ts`); o desenho
no canvas, não.

**História:** foto de celular passava do limite de 1 MB por documento do Firestore, era
recusada, e o formulário dizia "Anexo enviado" mesmo assim.

Passo a passo (em `/projetos` → editar um projeto de teste):

1. **Foto grande de celular** (2–5 MB, JPG) num Simulado com data.
   Deve aparecer: "Anexo enviado. A imagem foi reduzida para caber no limite de 1 MB."
   Recarregue a página: o anexo continua lá. Abra "Ver Linha do Tempo": a foto aparece no
   Simulado, **em pé se foi tirada em pé** (orientação EXIF respeitada).
2. **Imagem pequena** (< 700 KB) — deve aparecer só "Anexo enviado." (vai sem redução).
3. **PNG transparente grande** (> 750 KB) como brasão — o fundo transparente deve virar
   **branco**, não preto.
4. **Imagem na Implantação** (com data) — deve aparecer na Linha do Tempo e em "Ver detalhes".
5. **Sem internet** (DevTools → Network → Offline) e envie uma imagem: o botão fica
   carregando; **não** pode aparecer "Anexo enviado". Volte a conexão: conclui.
6. **HEIC** (foto de iPhone) no Chrome, se tiver uma: deve aparecer "Anexo não enviado" com
   o pedido de salvar como JPG ou PNG.
