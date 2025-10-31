# Diretrizes de Desenvolvimento (AI_RULES)

Este documento descreve a pilha de tecnologia (tech stack) e as regras de uso de bibliotecas para garantir a consistência e manutenibilidade do projeto OrçaBuffet.

## Visão Geral da Pilha de Tecnologia

O OrçaBuffet é construído com foco em simplicidade, desempenho e integração com IA.

*   **Frontend Framework:** React (usando TypeScript para tipagem forte).
*   **Estilização:** Tailwind CSS para um desenvolvimento rápido e responsivo, utilizando classes utilitárias.
*   **Build Tool:** Vite, configurado para desenvolvimento rápido e otimização de produção.
*   **Integração com IA:** Google GenAI SDK (`@google/genai`) para processamento de linguagem natural e geração de orçamentos estruturados.
*   **Componentes UI:** Shadcn/ui (biblioteca preferencial para componentes acessíveis e estilizados).
*   **Ícones:** Lucide-React (preferencial) e Font Awesome (atualmente via CDN).
*   **Estrutura de Código:** Arquivos de página em `src/pages/` e componentes reutilizáveis em `src/components/`.
*   **Roteamento:** Roteamento simples baseado em estado, centralizado no componente `App.tsx`.

## Regras de Uso de Bibliotecas e Abordagens

| Funcionalidade | Biblioteca/Abordagem Recomendada | Regra |
| :--- | :--- | :--- |
| **Componentes UI** | shadcn/ui | Utilize os componentes do shadcn/ui sempre que possível. Se for necessária customização, crie um novo componente que envolva o componente base. |
| **Estilização** | Tailwind CSS | Use exclusivamente classes utilitárias do Tailwind CSS para layout, cores e responsividade. |
| **Ícones** | Lucide-React | Priorize o uso de ícones do Lucide-React. Mantenha o uso de Font Awesome apenas onde já estiver implementado. |
| **Roteamento** | Estado em `App.tsx` | O controle de qual página está ativa deve ser gerenciado pelo estado `currentPage` dentro de `App.tsx`. |
| **Interação com IA** | `@google/genai` | Todas as chamadas ao modelo Gemini devem usar o SDK, garantindo que o `responseSchema` seja estritamente seguido para receber dados JSON confiáveis. |
| **Tipagem** | TypeScript (`types.ts`) | Todas as interfaces de dados compartilhadas (Estimate, CustomCost, etc.) devem ser definidas e importadas de `src/types.ts`. |