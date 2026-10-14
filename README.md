# Cecília e o caminho da Vovó Querida

Jogo infantil (3 a 6 anos) em HTML5 Canvas. Não precisa de build nem de imagens externas: todos os personagens são desenhados em código.

## Rodar no computador
Por causa do PWA/service worker, abra por um servidor local, não com duplo clique:

```
npx serve .
```
Depois acesse o endereço exibido (ex.: http://localhost:3000).

## Instalar no celular (PWA)
1. Publique a pasta em um host com HTTPS (GitHub Pages, Netlify, Vercel...).
2. Abra no Chrome (Android) → menu ⋮ → **Instalar app** / no iPhone (Safari) → Compartilhar → **Adicionar à Tela de Início**.
3. O jogo abre em tela cheia, na horizontal, e funciona offline.

## Como jogar
- Colha os **100 morangos** e pule nas caixinhas para pegar os **50 brigadeiros**.
- Quando o Lobo Mau aparece, o jogo congela (estilo RPG) e você escolhe quem ajuda: Dindo com o pau, Cavalinho (nos ombros do Dindo), Ana de patins, Layla (a cachorrinha) ou Patinete mágico.

## Controles
| Ação | Teclado | Celular |
|---|---|---|
| Andar | ← → ou A D | joystick (esquerda) |
| Pular / quebrar caixinha | Espaço, ↑ ou W | botão verde ⬆ (ou joystick para cima) |
| Escolher ajudante | 1 a 5, ou setas + Enter | tocar no cartão |
| Pausar | Esc ou P | ⏸ |

## Arquivos
- `game.js`: jogo inteiro (cenário, personagens, lobo, poderes, sons e falas)
- `style.css`: HUD, botões de toque e telas
- `manifest.webmanifest`, `sw.js`, `icons/`: PWA
