# Sun Gateway v1.0.0

Serviço HTTP JSON real, sem dependências externas, compatível com o SunApiBridge. O catálogo inicial utiliza os seis itens já existentes no Cinema aberto do Sun, com os créditos e licenças registrados no projeto. Não verifica disponibilidade de vídeo ao iniciar; não hospeda nem retransmite mídia.

## Executar

Na raiz do repositório: `python3 gateway/server.py`. Ou `docker build -t sun-gateway -f gateway/Dockerfile .` e `docker run --rm -p 8080:8080 sun-gateway`.

Teste: `curl 'http://localhost:8080/health'`, `curl 'http://localhost:8080/search?provider=cinema&q=Sol%20Levante'`, `curl 'http://localhost:8080/content?provider=cinema&mediaId=sol-levante'`, `curl 'http://localhost:8080/stream?provider=cinema&unitId=sol-levante-1&language=raw'`.

Para usar no Android, publique o container em um host HTTPS com domínio público, sem autenticação no endpoint. No Sun: Perfil > Gateway de APIs, informe a URL base HTTPS (sem /health). A configuração depende de uma conta de hospedagem; o repositório não cria um servidor público automaticamente.

## Provedores próprios

O operador pode fornecer um catálogo JSON local com direitos de reprodução e distribuição demonstrados, via variável SUN_AUTHORIZED_CATALOG. Monte o arquivo somente para leitura no container. O serviço anuncia o provedor licensed apenas quando configurado. Cada item precisa de id, title, catalogType (ANIME/MOVIE), audience (general/teen), license e episodes. Cada episódio requer id único, number, title, streams. Cada stream requer sourceUrl HTTPS autorizado e language (raw/sub/dub); quality, isHLS e subtitles são opcionais. Informe autoria, licença, fonte e classificação correta. O serviço não confere direitos ou classificação de arquivos enviados pelo operador. Não há raspagem de portais, proxy de vídeo, extração de credenciais ou contorno de DRM.

Testes: `python3 -m unittest discover -s gateway -p 'test_*.py'`. Os testes verificam o contrato JSON, não a reprodução real de vídeos.
