# Sun para Android

O Sun tem uma biblioteca online de animes em português e um player nativo com AndroidX Media3. Requer Android 8.0 ou superior.

## Biblioteca e reprodução

Abra **Buscar**, digite um título e escolha um resultado em **Episódios no Sun**. Toque em **Assistir** para começar ou selecione um episódio na ficha. A tela inicial traz populares, lançamentos, dublados e filmes. Use **Biblioteca de animes** para explorar as páginas do catálogo.

O catálogo consulta o [add-on público AnimesFHD](https://animesfhd.net/stremio/manifest.json) pelo protocolo Stremio. Títulos, temporadas, episódios e fontes vêm do provedor. Alguns arcos e temporadas têm fichas separadas. O APK resolve o endereço de vídeo quando você dá play. A disponibilidade e o idioma variam por episódio. O Sun não exige conta ou assinatura.

O player permite avançar ou voltar dez segundos, usar tela cheia e retomar do ponto salvo no aparelho. Trilhas de áudio, legendas e qualidades dependem da fonte. **Cinema aberto** é uma coleção adicional do Wikimedia Commons, com autoria e licença na ficha. **Meus vídeos** abre arquivos do aparelho e links diretos. O perfil permite exportar e restaurar sua biblioteca.

**No catálogo AniList** mostra resultados de descoberta. É possível associar um link próprio a essas fichas.

## APK

Baixe o arquivo APK em [Releases](https://github.com/elenaess/sun/releases). As compilações de teste usam assinatura de depuração. Se uma atualização apresentar conflito de assinatura, exporte sua biblioteca antes de remover a versão anterior.

O [GitHub Actions](https://github.com/elenaess/sun/actions/workflows/android.yml) compila o aplicativo e verifica sua assinatura. O teste no emulador busca um anime, abre o episódio e confere a reprodução no player nativo.

## Diagnóstico de fontes (v0.4.2)

O Sun usa um player nativo Media3. Ver itens/episódios no catálogo **não** garante
que haja um vídeo disponível. O aplicativo agora recusa páginas HTML/JSON fornecidas
por engano no lugar da mídia e distingue respostas HTTP 403/404 de contêineres
incompatíveis. Não contorna autenticação, DRM, bloqueios regionais ou permissões.

Cada plugin utiliza os próprios IDs de episódios: não é seguro consultar outro
plugin com o mesmo ID e presumir que se trata do mesmo vídeo. Para conferir se o
player funciona, abra um arquivo MP4 seu por **Meus vídeos** ou um título do
**Cinema aberto**. Se esses funcionarem e os demais não, verifique a fonte.

Esta atualização não garante reprodução dos títulos de provedores externos.
Não interprete o teste do GitHub Actions como prova de acesso ao servidor.

## Novidades v0.5.0 — múltiplas fontes e teste do player

- Até **18** manifestos HTTPS Stremio configuráveis, consultados como catálogos independentes.
- Busca de vídeos abertos do Wikimedia Commons e Internet Archive (somente resultados com indicação
  de CC BY, CC BY-SA, CC0 ou domínio público e formatos MP4/WebM).
- **Teste do player** no Perfil: amostra MP4 Big Buck Bunny da infraestrutura de
  testes do Android/ExoPlayer. Licença da animação: CC BY 3.0.
- Identificadores de episódios continuam vinculados ao provedor respectivo.
- Player AndroidX Media3 nativo, com HLS, DASH, MP4, WebM conforme codecs do aparelho.
- Nenhuma conta do Sun ou endereço especial de serviço é necessário.

AVISO: Muitos catálogos de animes famosos não disponibilizam streams licenciados.
Um resultado de catálogo NÃO garante link de vídeo. O app não faz bypass de
DRM, região ou HTTP 403, e não inclui extensões de origem não verificada.
As buscas Wikimedia/Archive usam metadados de licença dos contribuidores;
confira autoria/licença na ficha antes de redistribuir vídeos.

Se o teste Big Buck Bunny funcionar e outros vídeos falharem, o player está
provavelmente operacional e o problema está nos links ou nas fontes externas.
