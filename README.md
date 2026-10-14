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

## Controles
| Ação | Teclado | Celular |
|---|---|---|
| Andar | ← → ou A D | joystick (esquerda) |
| Pular | Espaço, ↑ ou W | botão verde ⬆ (ou joystick para cima) |
| Dindo com o pau | 1 ou Z | botão do pau |
| Cavalinho do Dindo | 2 ou X | botão do cavalo |
| Ana de patins | 3 ou C | botão da bolinha |
| Pausar | Esc ou P | ⏸ |

Os poderes só acendem quando o Lobo Mau aparece.

## Arquivos
- `game.js`: jogo inteiro (cenário, personagens, lobo, poderes, sons e falas)
- `style.css`: HUD, botões de toque e telas
- `manifest.webmanifest`, `sw.js`, `icons/`: PWA
