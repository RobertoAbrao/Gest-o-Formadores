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

## Dashboard do Administrador — "Precisa de você" (redesenho de 25/11/2026)

**Área:** `src/app/(app)/dashboard/page.tsx` e `src/components/dashboard/`.

**Por que é manual:** o projeto não tem teste de tela (precisaria de login e de um Firestore
de teste). A regra de cada coluna é testada (`src/lib/dashboard/agenda.test.ts`); o
comportamento da tela, não.

**História:** a versão antiga relia o banco inteiro a cada mudança e, enquanto relia,
trocava a página por um spinner. O detalhe da formação aberto fechava, voltava para a
primeira aba e perdia o texto digitado — bastava marcar um item do checklist. Concluir e
Arquivar saíam com um toque, sem confirmação.

Passo a passo (logado como administrador, em `/dashboard`):

1. **Não pisca.** Abra uma formação pelo Dashboard, digite algo numa observação (sem
   salvar) e marque um item do checklist. A janela continua aberta, na mesma aba, com o
   texto. Repita com outra pessoa (ou outra aba) editando uma formação: a lista atrás
   muda sozinha e a janela não fecha.
2. **Concluir pede confirmação.** Numa formação em "Atrasado" (terminou e não foi
   concluída), clique em Concluir: aparece a confirmação citando a demanda de
   agradecimento. Confirme: a formação fica com "Concluída · falta arquivar" e a demanda
   aparece em "Próximos 7 dias".
3. **Arquivar tem Desfazer.** Clique em Arquivar nela: o aviso mostra "Desfazer"; desfaça
   e ela volta.
4. **Bolinha da demanda.** Clique na bolinha de uma demanda: ela sai da lista e o aviso
   mostra "Desfazer". Abra a demanda no Diário (`/diario`): o histórico registra a mudança
   "(pelo Dashboard)".
5. **Filas.** "Falta concluir", "Começam em 7 dias" e "Sem formador" abrem o Acompanhamento
   já filtrado, com o mesmo número. "Demandas vencidas" e "Demandas sem prazo" filtram a
   própria tela.
6. **Celular (DevTools, 360 px).** As filas rolam de lado; as colunas viram abas
   "Atrasado · Hoje · 7 dias" com a contagem; nada vaza para a direita.
7. **Erro de leitura.** Quando o Firestore recusa uma consulta (ex.: perfil sem permissão),
   aparece o aviso "Não deu para carregar…" com "Tentar de novo", e as filas daquela
   coleção mostram "—" em vez de 0. Atenção: **sem internet não é erro** — o Firestore
   espera a conexão e pode mostrar o que tem em cache; não use o modo Offline para testar
   este passo.

## Campo "Material" do projeto — lista fixa (25/11/2026)

**Área:** `src/components/projetos/seletor-materiais.tsx` e o campo `material` em
`src/components/projetos/form-projeto.tsx`.

**Por que é manual:** a tela precisa de login e Firestore. A regra (ler, marcar, desmarcar,
preservar texto antigo) é testada em `src/lib/projetos/materiais.test.ts`; o clique, não.

**O que pode quebrar:** projeto antigo com texto livre perder o que estava escrito.

Passo a passo (em `/projetos` → editar):

1. **Projeto antigo com texto livre** (ex.: "Apostila própria"): abra, **não mexa** no
   Material, mude outro campo e salve. Em "Ver detalhes", o Material continua idêntico.
2. No mesmo projeto, marque **Sabe**: o campo mostra "Sabe, Apostila própria", e o texto
   antigo aparece marcado no grupo "Texto antigo (fora da lista)". Salve e confira.
3. Desmarque o texto antigo: some do campo. Salve: em "Ver detalhes" fica só "Sabe".
4. **Projeto novo**: marque dois produtos de selos diferentes (ex.: Peripécias e Sabe). O
   campo mostra "Sabe, Peripécias" (ordem do catálogo, não do clique).
5. Busca: digite "lum" no campo de busca do seletor: aparece **Lúmina**.
6. Na lista de `/projetos`, buscar "Sabe" ainda encontra o projeto.
