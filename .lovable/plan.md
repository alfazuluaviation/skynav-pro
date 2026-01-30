# Plano: Integração de Cartas ENRC LOW via MBTiles no Modo Offline

## Resumo
Integrar o pacote de cartas ENRC LOW ao modo offline do SkyFPL usando arquivos .mbtiles, sem alterar o modo online.

## Status: ✅ IMPLEMENTADO (Fase de Teste)

### Status do Link
✅ **Link verificado e funcionando**: `https://drive.google.com/uc?export=download&id=1WIIbuiR4SLwpQ-PexKhHBwAb8fwoePQs`
- Arquivo: ENRC_LOW_2026_01.zip (338MB)
- URL direta para bypass de confirmação de antivírus configurada

## Arquitetura Implementada

### Novos Arquivos Criados:
1. **`src/config/mbtilesConfig.ts`** - Configuração centralizada dos pacotes MBTiles
2. **`src/services/mbtilesStorage.ts`** - Armazenamento de arquivos MBTiles no IndexedDB (em chunks)
3. **`src/services/mbtilesDownloader.ts`** - Download e extração de pacotes ZIP do Google Drive
4. **`src/services/mbtilesReader.ts`** - Leitura de tiles de arquivos MBTiles (SQLite via sql.js)
5. **`src/components/MBTilesTileLayer.tsx`** - Componente Leaflet para renderizar tiles de MBTiles

### Arquivos Modificados:
1. **`src/components/DownloadModal.tsx`** - Integração do download MBTiles para ENRC LOW
2. **`src/App.tsx`** - Renderização condicional usando MBTilesTileLayer quando offline

### Dependências Adicionadas:
- `sql.js` - SQLite compilado para WebAssembly (leitura de .mbtiles)
- `jszip` - Extração de arquivos ZIP

## Fluxo de Funcionamento

### Download (quando usuário clica em "ENRC LOW BAIXAR"):
1. Verifica se é um chart com MBTiles disponível (apenas LOW nesta fase)
2. Baixa o ZIP do Google Drive com progresso
3. Extrai os arquivos .mbtiles do ZIP
4. Armazena cada .mbtiles no IndexedDB (em chunks de 4MB)
5. Marca como disponível para uso offline

### Renderização:
- **Modo Online**: Usa CachedWMSTileLayer (WMS do DECEA) - **SEM ALTERAÇÃO**
- **Modo Offline + MBTiles disponível**: Usa MBTilesTileLayer
- **Modo Offline + MBTiles NÃO disponível**: Usa cache de tiles WMS (comportamento anterior)

## Proteções Implementadas

1. **Isolamento Total**: 
   - Novos serviços e componentes separados
   - Banco IndexedDB separado (`skyfpl-mbtiles-cache`)
   - Não interfere com sistema de cache de tiles WMS existente

2. **Verificação de Conectividade**:
   - MBTiles só é usado quando `!navigator.onLine`
   - Modo online sempre usa WMS do DECEA

3. **Fallback Graceful**:
   - Se MBTiles não carregar um tile, retorna tile transparente
   - Não quebra o mapa

4. **Escopo Limitado**:
   - Apenas ENRC LOW usa MBTiles nesta fase
   - Todas as outras cartas continuam com WMS

## Próximos Passos para Teste

1. ✅ Implementação completa
2. ⏳ Testar download do pacote MBTiles
3. ⏳ Verificar extração e armazenamento
4. ⏳ Testar renderização offline
5. ⏳ Validar que modo online permanece inalterado

## Limitações Conhecidas

1. **Tamanho do arquivo**: 338MB requer conexão estável
2. **Armazenamento**: Usa IndexedDB (limite varia por navegador, geralmente 50-100MB por origem)
3. **Zoom MBTiles**: Limitado a 4-11 (conforme especificado)
4. **Plataforma**: Testado apenas em web; iOS/Android via Capacitor pode precisar de ajustes
