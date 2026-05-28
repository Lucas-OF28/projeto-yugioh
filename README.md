# Yu-Gi-Oh! Card Generator

Gerador de cartas personalizadas no estilo Yu-Gi-Oh!, com backend local em Node.js e banco de dados em arquivo JSON.

---

## Requisitos

- [Node.js](https://nodejs.org/) versão 18 ou superior

---

## Instalação

Clone ou baixe o repositório e, dentro da pasta do projeto, instale as dependências:

```bash
npm install
```

---

## Como iniciar

```bash
npm start
```

Abra o navegador em: **http://localhost:3000**

Para desenvolvimento com reinício automático ao salvar arquivos:

```bash
npm run dev
```

---

## Como usar

### Página inicial

Exibe os contadores de cartas cadastradas (total, monstros, magias e armadilhas) e dois botões de navegação.

---

### Cadastrar uma carta

1. Clique em **Nova Carta** na página inicial ou no botão **+ Nova Carta** na listagem.
2. Preencha o formulário:
   - **Nome** — nome da carta (obrigatório)
   - **Tipo** — Monstro, Magia ou Armadilha
   - Os campos mudam automaticamente conforme o tipo escolhido:
     - **Monstro**: atributo, nível (1–12), tipo do monstro, subtipo (Normal, Efeito, Fusão...), ATK e DEF
     - **Magia**: tipo de magia (Normal, Contínua, Campo...)
     - **Armadilha**: tipo de armadilha (Normal, Contínua, Contador)
   - **Descrição** — texto de efeito ou lore da carta
   - **URL da Imagem** — cole um link de imagem para aparecer na carta (opcional)
3. A **prévia à direita** atualiza em tempo real conforme você preenche.
4. Clique em **Cadastrar Carta**.

---

### Ver e gerenciar cartas

1. Clique em **Ver Cartas** na página inicial.
2. Use os **botões de filtro** para exibir apenas Monstros, Magias ou Armadilhas.
3. Use a **barra de busca** para filtrar pelo nome.
4. Cada carta exibe os botões **Editar** e **Deletar**.

---

### Editar uma carta

Clique em **Editar** em qualquer carta da listagem. O formulário abre pré-preenchido com os dados atuais. Altere o que quiser e clique em **Salvar Alterações**.

---

### Deletar uma carta

Clique em **Deletar** e confirme a ação na caixa de diálogo.

---

## API REST

O servidor expõe os seguintes endpoints em `http://localhost:3000/api/cartas`:

| Método | Rota              | Descrição                  |
|--------|-------------------|----------------------------|
| GET    | /api/cartas       | Lista todas as cartas       |
| GET    | /api/cartas/:id   | Retorna uma carta pelo ID   |
| POST   | /api/cartas       | Cria uma nova carta         |
| PUT    | /api/cartas/:id   | Atualiza uma carta          |
| DELETE | /api/cartas/:id   | Remove uma carta            |

### Exemplo de corpo para POST/PUT (Monstro)

```json
{
  "nome": "Dragão Negro de Olhos Vermelhos",
  "tipo": "MONSTRO",
  "atributo": "TREVAS",
  "nivel": 7,
  "tipo_monstro": "Dragão",
  "tipo_efeito": "Efeito",
  "ataque": 2400,
  "defesa": 2000,
  "descricao": "Um dragão lendário de poder destrutivo.",
  "imagem": "https://url-da-imagem.jpg"
}
```

### Exemplo de corpo para POST/PUT (Magia)

```json
{
  "nome": "Polimeriização",
  "tipo": "MAGIA",
  "tipo_magia": "Normal",
  "descricao": "Fusione monstros da sua mão ou campo."
}
```

---

## Estrutura do projeto

```
projeto-yugioh/
├── server.js              # Servidor Express + rotas da API
├── database.js            # Gerenciamento do banco de dados (JSON)
├── yugioh.json            # Arquivo de dados (criado automaticamente)
├── package.json
│
├── index.html             # Página inicial
├── style.css              # Estilos globais
├── card-styles.css        # Visual das cartas Yu-Gi-Oh
│
└── pages/
    ├── verCartas.html     # Listagem de cartas
    ├── ver.js
    ├── ver.css
    ├── cadastrarCartas.html  # Formulário de cadastro/edição
    ├── cadastrar.js
    └── cadastro.css
```

---

## Banco de dados

As cartas são salvas no arquivo `yugioh.json` na raiz do projeto. Ele é criado automaticamente na primeira execução. Não é necessário configurar nenhum banco de dados externo.

---

*By Jean Ricken & Lucas Fabris*
