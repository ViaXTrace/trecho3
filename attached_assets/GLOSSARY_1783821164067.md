# Glossário e guia de estilo — tradução PT-BR de Subarashiki Hibi

## Regra de ouro
- Traduza para português do Brasil **sem nenhum acento ou cedilha** (o
  encoding do jogo não suporta essas letras). Escreva "nao", "voce", "coracao",
  "ate", "e" (verbo ser/estar), "so", "ja", "esta", "aqui", "ninguem", etc.
  Isso vale para TODO texto inserido nas tags `<pt...>`.
- Nunca traduza identificadores técnicos: nomes de arquivo (`.bss`, `.bmp`),
  IDs de voz (`taku_000123`), IDs de som/música (`se246`, `bgm020`), nomes de
  sprite/cena (`bg1023b`, `zk0108a`). Se a linha `<en...>` for claramente um
  identificador técnico (sem espaços, formato tipo código), copie o mesmo
  valor para a linha `<pt...>` sem alterar.
- Conteúdo sexual explícito: NÃO traduza. Copie o texto em inglês
  literalmente para a linha `<pt...>` (deixe igual ao `<en...>`). Isso vale
  para a cena inteira, não apenas a frase mais explícita.
- Mantenha a pontuação de diálogo do jogo (aspas retas `"..."`, reticências
  `...`, travessão de fala) e quebras de linha internas do texto original.
- Preserve marcações especiais como `【Nome】` nos comentários — elas não são
  traduzidas, são apenas comentários de contexto (indicam quem fala).

## Nomes próprios (NÃO traduzir, manter grafia idêntica ao inglês)
Takuji, Zakuro, Yuki, Kotomi, Kagami, Tsukasa, Miu, Ayana, Ayumi, Asumi,
Hasaki, Hiroo, Iida, Iinuma, Kimika, Kimura, Kiyokawa, Kiyoshi, Mamiya,
Megu, Minakami, Numada, Nishimura, Riruru, Satoko, Senagawa, Shiroyama,
Tomosane, Usami, Yasuko.

Combinações como "Kagami+Tsukasa", "Takuji+Kotomi", "Tsukasa+Zakuro",
"Zakuro+Kagami" são tags internas (indicam múltiplos falantes) — mantenha
idênticas, não traduza.

Papéis genéricos (traduzir normalmente quando aparecem como texto de
diálogo/narração, mas como NAME/rótulo de quem fala, também podem ficar em
português): Teacher -> Professor(a), Coach -> Treinador, Customer -> Cliente,
Waiter -> Garcom, Doll -> Boneca, Old Man -> Velho, Old Lady -> Velha,
Believer -> Crente, God -> Deus. Use o bom senso: como a maioria dessas tags
de NAME é só um rótulo interno (não aparece na tela), pode traduzir o rótulo
mas o mais importante é manter a tradução do texto de diálogo real coerente
com o personagem.

## Tom e estilo
- Registro coloquial, natural, como fala jovem brasileira contemporânea
  (os protagonistas são estudantes do ensino médio). Evite formalidade
  excessiva ou traduções literais/robóticas.
- Preserve gírias e humor do inglês adaptando para uma gíria equivalente em
  português quando fizer sentido, mas sem exagerar a ponto de soar
  anacrônico.
- Falas curtas e interjeições ("Eh?", "Umm...", "Haa...") podem virar
  equivalentes naturais em português ("Ha?", "Hum...", "Aah...").
