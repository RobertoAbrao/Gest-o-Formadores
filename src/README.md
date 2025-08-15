# Portal de Apoio Pedagógico - Gestão de Formadores

Este é um projeto Next.js que serve como um portal de apoio pedagógico, projetado para gerenciar formadores, assessores, formações, projetos de implantação, materiais de apoio, despesas e avaliações. O sistema possui dois perfis de usuário principais: Administrador e Formador, cada um com seu próprio conjunto de permissões e funcionalidades.

## Tecnologias Utilizadas

- **Framework:** Next.js (com App Router)
- **Linguagem:** TypeScript
- **Estilização:** Tailwind CSS
- **Componentes UI:** shadcn/ui
- **Backend & Banco de Dados:** Firebase (Firestore, Authentication)
- **Gráficos e Visualização:** Recharts
- **Validação de Formulários:** Zod e React Hook Form

---

## Funcionalidades Principais

### 1. Autenticação e Perfis de Usuário

- **Tela de Login Segura:** Acesso com email e senha utilizando Firebase Authentication.
- **Dois Tipos de Perfil:**
  - **Administrador:** Possui controle total sobre o sistema, gerenciando todos os dados e usuários.
  - **Formador:** Acesso focado em suas atividades de formação, despesas e materiais.
- **Redirecionamento Automático:** Após o login, os usuários são direcionados para o painel correspondente ao seu perfil.

### 2. Painel do Administrador

O administrador tem acesso a um conjunto completo de ferramentas para gerenciar todas as operações do portal.

- **Dashboard Centralizado:**
  - **Visão Geral:** Cards com estatísticas chave, como o número de formadores ativos, materiais disponíveis e formações ativas.
  - **Agenda de Eventos Interativa:** Um calendário que exibe todas as datas importantes, com um sistema de cores para diferenciar eventos:
    - **Formações:** Datas de início e fim.
    - **Marcos de Projeto:** Datas de migração e implantação.
    - **Acompanhamentos de Projeto:** Prazos para simulados e devolutivas.

- **Gerenciamento de Formadores e Assessores:**
  - CRUD completo (Criar, Ler, Atualizar, Excluir) para os perfis dos formadores e assessores.
  - Os perfis são agrupados por estado (UF) em uma interface com acordeão para melhor organização.
  - Visualização detalhada de cada perfil, incluindo informações pessoais, de contato, currículo e dados bancários.

- **Gerenciamento de Materiais de Apoio:**
  - Adição, edição e exclusão de materiais (PDFs, vídeos, links) que ficam disponíveis para todos os formadores.

- **Quadro de Acompanhamento (Kanban):**
  - Visualização do ciclo de vida de todas as formações ativas em um quadro no estilo Kanban, com colunas como "Preparação", "Em Formação", "Pós Formação" e "Concluído".
  - Permite criar e editar formações, associando formadores, materiais e detalhes logísticos (passagens, hospedagem).

- **Gerenciamento de Projetos de Implantação:**
  - Uma seção dedicada para criar e acompanhar projetos de implantação em municípios.
  - Registro de datas cruciais como migração de dados e implantação do sistema.
  - Acompanhamento de status (OK/Pendente) para avaliações diagnósticas e simulados.
  - Cronograma detalhado para as devolutivas, associando formadores e prazos.

- **Relatórios Detalhados e Impressão:**
  - Geração de relatórios completos por formação, incluindo um resumo de informações, linha do tempo de anexos, despesas detalhadas e resultados agregados das avaliações.
  - Funcionalidade para impressão do relatório formatado.

- **Formações Arquivadas:**
  - Consulta a um histórico de todas as formações que já foram concluídas e arquivadas.

### 3. Painel do Formador

O painel do formador é projetado para ser uma ferramenta de trabalho focada e eficiente.

- **Visualização de Materiais:** Acesso direto à biblioteca de materiais de apoio cadastrados pelo administrador, com opção para download ou acesso ao link.
- **Relatório de Despesas:**
  - Lançamento de despesas (alimentação, transporte, etc.) associadas a uma formação em andamento.
  - Upload de comprovantes de imagem para cada despesa.
  - Visualização organizada das despesas por tipo, com totais calculados automaticamente.
- **Meu Perfil:** Visualização dos seus dados cadastrais, como municípios de responsabilidade, disciplina e currículo.

### 4. Avaliação de Formações

- **Formulário Público e Acessível:** Um formulário de avaliação detalhado que pode ser acessado por qualquer participante através de um link público, sem necessidade de login.
- **Validação de Dados em Tempo Real:** O formulário inclui validações para garantir a qualidade dos dados, como a confirmação de e-mail.
- **Feedback Visual:** Exibe uma mensagem de sucesso clara após o envio e destaca os campos com erro em caso de falha na validação.
- **Resultados Centralizados e Privados:** As respostas são salvas de forma segura no Firestore. Apenas administradores podem visualizar os resultados, que são exibidos de forma agregada (gráficos e médias) e individual no relatório da formação.

---

## Estrutura do Projeto

A estrutura de pastas segue as convenções do Next.js App Router:

- `src/app/(app)`: Contém as páginas principais da aplicação que exigem autenticação (Dashboard, Quadro, Projetos, etc.).
- `src/app/(auth)`: Rotas de autenticação (página de login).
- `src/app/avaliacao/[id]`: Página pública do formulário de avaliação.
- `src/app/relatorio/[id]`: Página de visualização e impressão do relatório de formação.
- `src/components`: Componentes React reutilizáveis, incluindo componentes de UI (shadcn/ui), formulários e componentes de layout.
- `src/hooks`: Hooks customizados, como `useAuth` para o gerenciamento de autenticação.
- `src/lib`: Funções utilitárias, configuração do Firebase (`firebase.ts`) e definições de tipos TypeScript (`types.ts`).
- `firestore.rules`: Arquivo de regras de segurança para o Cloud Firestore.
