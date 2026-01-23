# Portal de Apoio Pedagógico - Gestão Pedagógica

Este é um projeto Next.js que serve como um portal de apoio pedagógico, projetado para gerenciar formadores, formações, materiais de apoio, despesas e avaliações. O sistema possui dois perfis de usuário principais: Administrador e Formador, cada um com seu próprio conjunto de permissões e funcionalidades.

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

- **Tela de Login:** Acesso seguro com email e senha.
- **Dois Tipos de Perfil:**
  - **Administrador:** Possui controle total sobre o sistema.
  - **Formador:** Acesso focado em suas atividades de formação e despesas.
- **Redirecionamento Automático:** Após o login, os usuários são direcionados para o painel correspondente ao seu perfil.

### 2. Painel do Administrador

- **Dashboard:** Uma visão geral com estatísticas chave, como o número de formadores ativos, materiais disponíveis e municípios cobertos.
- **Gerenciamento de Formadores:**
  - CRUD completo (Criar, Ler, Atualizar, Excluir) para os perfis dos formadores.
  - Os formadores são agrupados por estado (UF) para melhor organização.
- **Gerenciamento de Assessores:**
  - CRUD completo para os perfis dos assessores, similar ao de formadores.
- **Gerenciamento de Materiais de Apoio:**
  - Adição, edição e exclusão de materiais (PDFs, vídeos, links) que ficam disponíveis para todos os formadores.
- **Quadro de Acompanhamento (Kanban):**
  - Visualização do ciclo de vida de todas as formações em um quadro no estilo Kanban, com colunas como "Preparação", "Em Formação", "Pós Formação" e "Concluído".
  - Permite criar e editar formações, associando formadores e materiais.
- **Formulário de Avaliação:**
  - Um link de formulário de avaliação público pode ser compartilhado para cada formação.
- **Relatórios de Formação:**
  - Geração de relatórios detalhados por formação, incluindo um resumo completo dos resultados das avaliações e despesas.
  - Funcionalidade para impressão do relatório.
- **Formações Arquivadas:**
  - Consulta a um histórico de todas as formações que já foram concluídas e arquivadas.

### 3. Painel do Formador

- **Visualização de Materiais:** Acesso à biblioteca de materiais de apoio cadastrados pelo administrador.
- **Relatório de Despesas:**
  - Lançamento de despesas (alimentação, transporte, etc.) associadas a uma formação ativa.
  - Upload de comprovantes para cada despesa.
  - Visualização organizada das despesas por tipo.
- **Meu Perfil:** Visualização dos seus dados cadastrais, como municípios de responsabilidade e currículo.

### 4. Avaliação de Formações

- **Formulário Público:** Um formulário de avaliação detalhado que pode ser acessado por qualquer participante através de um link.
- **Validação de Dados:** O formulário inclui validações para garantir a qualidade dos dados, como a confirmação de e-mail.
- **Feedback Visual:** Exibe uma mensagem de sucesso clara após o envio, sem redirecionar o usuário, e destaca os campos com erro em caso de falha na validação.
- **Centralização dos Resultados:** As respostas são salvas no Firestore e exibidas de forma agregada e detalhada no relatório da formação, acessível apenas pelo administrador.
- **Segurança:** As regras do Firestore garantem que qualquer pessoa possa enviar uma avaliação, mas apenas administradores autenticados possam ler os resultados.

---

## Estrutura do Projeto

A estrutura de pastas segue as convenções do Next.js App Router:

- `src/app/(app)`: Contém as páginas principais da aplicação que exigem autenticação (Dashboard, Quadro, Materiais, etc.).
- `src/app/(auth)`: Rotas de autenticação (página de login).
- `src/app/avaliacao/[id]`: Página pública do formulário de avaliação.
- `src/components`: Componentes React reutilizáveis, incluindo componentes da UI (shadcn/ui), formulários e componentes de layout.
- `src/hooks`: Hooks customizados, como `useAuth` para o gerenciamento de autenticação.
- `src/lib`: Funções utilitárias, configuração do Firebase (`firebase.ts`) e definições de tipos TypeScript (`types.ts`).