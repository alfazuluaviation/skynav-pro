# SkyFPL - Documentação Técnica de Funcionalidades

> **IMPORTANTE:** Este arquivo contém APENAS funcionalidades testadas e aprovadas pelo usuário.  
> Atualizações são feitas exclusivamente após validação explícita.  
> Última atualização: 2025-01-23

---

## Índice

1. [Sistema de Mapas e Camadas](#1-sistema-de-mapas-e-camadas)
2. [Cartas Aeronáuticas](#2-cartas-aeronáuticas)
3. [Sistema Offline](#3-sistema-offline)
4. [Plano de Voo](#4-plano-de-voo)
5. [Autenticação e Usuário](#5-autenticação-e-usuário)
6. [Dados Aeronáuticos](#6-dados-aeronáuticos)
7. [Interface do Usuário](#7-interface-do-usuário)

---

## 1. Sistema de Mapas e Camadas

### 1.1 Mapas Base
- **Status:** ⏳ Aguardando aprovação
- **Descrição:** -
- **Arquivos:** `src/components/CachedBaseTileLayer.tsx`
- **Como funciona:** -

### 1.2 Camadas WMS (Cartas Aeronáuticas Online)
- **Status:** ⏳ Aguardando aprovação
- **Descrição:** -
- **Arquivos:** `src/components/CachedWMSTileLayer.tsx`, `src/config/chartLayers.ts`
- **Como funciona:** -

---

## 2. Cartas Aeronáuticas

### 2.1 Configuração das Cartas
- **Status:** ⏳ Aguardando aprovação
- **Cartas suportadas:** REH, WAC, ENRC HIGH, ENRC LOW, REA, REUL, ARC
- **Arquivos:** `src/config/chartLayers.ts`
- **Níveis de zoom configurados:** -
- **Notas técnicas:** -

### 2.2 Menu de Seleção de Camadas
- **Status:** ⏳ Aguardando aprovação
- **Arquivos:** `src/components/LayersMenu.tsx`
- **Como funciona:** -

---

## 3. Sistema Offline

### 3.1 Download de Cartas com Checkpoint
- **Status:** ⏳ Aguardando aprovação
- **Descrição:** -
- **Arquivos:** `src/services/chartDownloader.ts`, `src/services/downloadManager.ts`
- **Como funciona:** -

### 3.2 Cache de Tiles (IndexedDB)
- **Status:** ⏳ Aguardando aprovação
- **Descrição:** -
- **Arquivos:** `src/services/tileCache.ts`
- **Como funciona:** -

### 3.3 Download de Mapas Base
- **Status:** ⏳ Aguardando aprovação
- **Descrição:** -
- **Arquivos:** `src/services/baseMapDownloader.ts`
- **Como funciona:** -

---

## 4. Plano de Voo

### 4.1 Criação e Edição de Waypoints
- **Status:** ⏳ Aguardando aprovação
- **Descrição:** -
- **Arquivos:** `src/components/FlightPlanPanel.tsx`, `src/App.tsx`
- **Como funciona:** -

### 4.2 Rota Arrastável
- **Status:** ⏳ Aguardando aprovação
- **Descrição:** -
- **Arquivos:** `src/components/DraggableRoute.tsx`
- **Como funciona:** -

### 4.3 Cálculos de Navegação
- **Status:** ⏳ Aguardando aprovação
- **Descrição:** -
- **Arquivos:** `src/utils/geoUtils.ts`
- **Como funciona:** -

### 4.4 Exportação do Plano de Voo
- **Status:** ⏳ Aguardando aprovação
- **Descrição:** -
- **Arquivos:** `src/components/FlightPlanDownloadModal.tsx`, `src/components/DownloadModal.tsx`
- **Como funciona:** -

---

## 5. Autenticação e Usuário

### 5.1 Login/Registro com Supabase
- **Status:** ⏳ Aguardando aprovação
- **Descrição:** -
- **Arquivos:** `src/components/Auth.tsx`, `src/components/AuthModal.tsx`
- **Como funciona:** -

### 5.2 Proteção de Rotas/Ações
- **Status:** ⏳ Aguardando aprovação
- **Descrição:** -
- **Arquivos:** `src/hooks/useAuthGuard.ts`
- **Como funciona:** -

---

## 6. Dados Aeronáuticos

### 6.1 Sincronização AIRAC
- **Status:** ⏳ Aguardando aprovação
- **Descrição:** -
- **Arquivos:** `src/services/airacService.ts`, `src/components/AiracInfo.tsx`
- **Como funciona:** -

### 6.2 Busca de Aeródromos
- **Status:** ⏳ Aguardando aprovação
- **Descrição:** -
- **Arquivos:** `src/services/NavigationDataService.ts`, `supabase/functions/search-aerodrome/`
- **Como funciona:** -

### 6.3 Consulta de Cartas (PDFs)
- **Status:** ⏳ Aguardando aprovação
- **Descrição:** -
- **Arquivos:** `src/components/ChartsModal.tsx`, `supabase/functions/fetch-charts/`
- **Como funciona:** -

---

## 7. Interface do Usuário

### 7.1 Modo Noturno
- **Status:** ⏳ Aguardando aprovação
- **Descrição:** -
- **Arquivos:** `src/App.tsx`, `src/index.css`
- **Como funciona:** -

### 7.2 PWA e Instalação
- **Status:** ⏳ Aguardando aprovação
- **Descrição:** -
- **Arquivos:** `src/hooks/usePWAUpdate.ts`, `src/components/PWAUpdatePrompt.tsx`
- **Como funciona:** -

### 7.3 Indicador Offline
- **Status:** ⏳ Aguardando aprovação
- **Descrição:** -
- **Arquivos:** `src/components/OfflineIndicator.tsx`
- **Como funciona:** -

---

## Histórico de Alterações

| Data | Funcionalidade | Descrição | Aprovado |
|------|----------------|-----------|----------|
| 2025-01-23 | Estrutura inicial | Criação do arquivo de documentação | ✅ |

---

## Instruções de Uso

### Para o Usuário:
1. Teste a funcionalidade no aplicativo
2. Confirme que está 100% funcional
3. Solicite: "Adicione [FUNCIONALIDADE] ao TECHNICAL_FEATURES.md"
4. Forneça detalhes relevantes do teste

### Para Desenvolvedores/IA:
1. Consulte este arquivo antes de modificar funcionalidades existentes
2. Use as descrições técnicas para entender a implementação atual
3. Em caso de regressão, use os detalhes aqui para restaurar a funcionalidade
4. **NUNCA** adicione funcionalidades sem aprovação explícita do usuário

---

## Notas Gerais

- **Tecnologias principais:** React 19, TypeScript, Leaflet, Supabase, IndexedDB
- **Armazenamento offline:** IndexedDB via `src/services/tileCache.ts`
- **Backend:** Supabase Edge Functions
- **Estilos:** Tailwind CSS com tokens semânticos
