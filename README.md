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
