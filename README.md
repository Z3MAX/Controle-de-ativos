# Sistema de Controle de Ativos

Sistema moderno para controle e gestão de ativos empresariais com análise por Inteligência Artificial para identificação automática de equipamentos.

## 🚀 Funcionalidades

- **Gestão de Ativos**: Cadastro completo de ativos com fotos, categorias e localizações
- **Análise por IA**: Identificação automática de objetos através de fotos
- **Gestão de Localizações**: Organização por andares e salas
- **Filtros Avançados**: Busca por nome, código, andar e sala
- **Interface Responsiva**: Design moderno e adaptável para mobile e desktop
- **Status de Ativos**: Controle de status (Ativo, Inativo, Manutenção, Descartado)

## 🛠️ Tecnologias Utilizadas

- **React 18** - Framework para interface
- **Vite** - Build tool e dev server
- **Tailwind CSS** - Framework de estilos
- **Lucide React** - Ícones modernos
- **JavaScript/JSX** - Linguagem de programação

## 📋 Pré-requisitos

- Node.js (versão 16 ou superior)
- npm ou yarn

## 🔧 Instalação

1. Clone o repositório:
```bash
git clone [seu-repositorio]
cd sistema-controle-ativos
```

2. Instale as dependências:
```bash
npm install
```

3. Execute o projeto em desenvolvimento:
```bash
npm run dev
```

4. Acesse no navegador:
```
http://localhost:3000
```

## 📦 Build para Produção

Para criar uma versão otimizada para produção:

```bash
npm run build
```

Os arquivos serão gerados na pasta `dist/`.

## 🌐 Deploy no Netlify

Este projeto está configurado para deploy automático no Netlify:

1. Conecte seu repositório GitHub ao Netlify
2. Configure as seguintes opções:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
3. O deploy será feito automaticamente a cada push na branch principal

## 📁 Estrutura do Projeto

```
sistema-controle-ativos/
├── public/
├── src/
│   ├── App.jsx          # Componente principal
│   ├── main.jsx         # Ponto de entrada
│   └── index.css        # Estilos globais
├── index.html           # Template HTML
├── package.json         # Dependências
├── vite.config.js       # Configuração do Vite
├── tailwind.config.js   # Configuração do Tailwind
└── README.md
```

## 🤖 Funcionalidade de IA

O sistema inclui uma simulação de análise por IA que:
- Identifica automaticamente objetos em fotos
- Sugere categorias baseadas no objeto identificado
- Fornece descrições detalhadas
- Calcula nível de confiança da análise
- Lista características do objeto

## 💡 Como Usar

1. **Criar Localizações**: Vá para a aba "Localizações" e cadastre salas nos andares
2. **Cadastrar Ativos**: Use o botão "Novo Ativo" para adicionar equipamentos
3. **Capturar Fotos**: Ao adicionar uma foto, a IA analisará automaticamente
4. **Filtrar e Buscar**: Use os filtros para encontrar ativos específicos
5. **Visualizar Detalhes**: Clique no ícone de "olho" para ver informações completas

## 🛡️ Segurança

- Todos os dados são armazenados localmente no navegador
- Não há envio de informações para servidores externos
- As fotos são processadas localmente

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo LICENSE para mais detalhes.

## 🤝 Contribuições

Contribuições são bem-vindas! Sinta-se à vontade para:
- Reportar bugs
- Sugerir novas funcionalidades
- Enviar pull requests

---

Desenvolvido com ❤️ para facilitar a gestão de ativos empresariais.