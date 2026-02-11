# Portal de Apoio Pedagógico - Gestão Pedagógica

Este é um projeto Next.js que serve como um portal de apoio pedagógico, projetado para gerenciar formadores, assessores, formações, projetos de implantação, materiais de apoio, despesas e avaliações. O sistema possui dois perfis de usuário principais: Administrador e Formador, cada um com seu próprio conjunto de permissões e funcionalidades, além de páginas públicas para coleta de feedback e alinhamento.

## Tecnologias Utilizadas

- **Framework:** Next.js (com App Router)
- **Linguagem:** TypeScript
- **Estilização:** Tailwind CSS
- **Componentes UI:** shadcn/ui
- **Backend & Banco de Dados:** Firebase (Firestore, Authentication)
- **Geração de IA:** Genkit
- **Gráficos e Visualização:** Recharts
- **Validação de Formulários:** Zod e React Hook Form

---

## Funcionalidades Principais

### 1. Painel do Administrador

O administrador tem acesso a um conjunto completo de ferramentas para gerenciar todas as operações do portal.

- **Dashboard Centralizado:**
  - Visão geral com estatísticas chave (demandas, materiais, formações) e uma agenda interativa de eventos.

- **Visão Gerencial:**
  - Um painel em tempo real para a liderança, mostrando o progresso dos projetos de implantação, status das etapas, e demandas críticas (urgentes ou atrasadas).

- **Diário de Bordo:**
  - Um sistema de gestão de tarefas (demandas) com filtros por responsável, prioridade e status, permitindo acompanhar de perto todas as pendências.

- **Gestão de Usuários:**
  - CRUD completo para os perfis dos **Formadores** e **Assessores**, organizados por estado (UF).

- **Gestão de Conteúdo:**
  - **Materiais de Apoio:** Biblioteca centralizada de PDFs, vídeos e links para os formadores.
  - **Cards de Divulgação:** Ferramenta para criar cards dinâmicos para eventos e formações.

- **Acompanhamento de Formações (Quadro Kanban):**
  - Visualização do ciclo de vida de todas as formações ativas em um quadro Kanban ("Preparação", "Em Formação", etc.), com criação e edição de atividades.

- **Projetos de Implantação:**
  - Seção dedicada para criar e acompanhar projetos de implantação em municípios, registrando datas cruciais, status de marcos (diagnóstica, simulados, devolutivas) e cronogramas.

- **Calendário de Planejamento:**
  - Ferramenta estratégica para planejar e visualizar o cronograma de múltiplos projetos, com a capacidade de sincronizar datas e compartilhar links de alinhamento com os municípios.

- **Relatórios e Fichas:**
  - Geração de relatórios detalhados e imprimíveis por formação, incluindo despesas e resultados de avaliações.
  - Geração de "Fichas de Devolutiva" com o cronograma e detalhes do evento para envio ao cliente.

- **Funcionalidades de IA:**
  - Geração automática de **Mapas Mentais** em Markdown a partir dos dados consolidados nos relatórios de avaliação.

- **Integrações:**
  - Visualização de dashboards interativos incorporados do **Power BI**.

### 2. Painel do Formador

O painel do formador é projetado para ser uma ferramenta de trabalho focada e eficiente.

- **Visualização de Materiais:** Acesso direto à biblioteca de materiais de apoio.
- **Relatório de Despesas:** Lançamento de despesas (alimentação, transporte, etc.) associadas a uma formação, com upload de comprovantes.
- **Diário de Bordo:** Acesso para visualizar e atualizar as demandas que lhe foram atribuídas.
- **Meu Perfil:** Visualização de seus dados cadastrais.

### 3. Páginas Públicas

- **Formulário de Avaliação:** Link público por formação para que os participantes avaliem o evento e o formador. Os resultados são privados e consolidados nos relatórios.
- **Formulário de Avaliação da Secretaria:** Um formulário dedicado para o feedback da Secretaria de Educação sobre a formação.
- **Formulário de Alinhamento Técnico:** Página para que os municípios validem ou sugiram novas datas para o cronograma de um projeto de implantação.

---

## Estrutura do Projeto

A estrutura de pastas segue as convenções do Next.js App Router:

- `src/app/(app)`: Contém as páginas principais da aplicação que exigem autenticação.
- `src/app/(auth)`: Rotas de autenticação (página de login).
- `src/app/avaliacao/[id]`: Página pública do formulário de avaliação dos participantes.
- `src/app/avaliacao-secretaria/[id]`: Página pública do formulário de avaliação da secretaria.
- `src/app/alinhamento/[id]`: Página pública para alinhamento de cronograma com o município.
- `src/app/relatorio/[id]`: Página de visualização e impressão do relatório de formação.
- `src/app/ficha/[id]`: Página de geração da ficha de curso/devolutiva.
- `src/components`: Componentes React reutilizáveis.
- `src/hooks`: Hooks customizados (`useAuth`, etc.).
- `src/lib`: Funções utilitárias, configuração do Firebase e definições de tipos.
- `src/ai`: Fluxos e configurações do Genkit para funcionalidades de IA.
- `firestore.rules`: Arquivo de regras de segurança para o Cloud Firestore.
