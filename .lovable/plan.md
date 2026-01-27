
# Plano de Correções: SkyFPL

## Resumo dos Problemas

1. **Cor do alerta PWA translúcida** - O componente `PWAUpdatePrompt.tsx` usa classes Tailwind genéricas (`primary`) que não estão resultando na cor laranja original
2. **Problema no iPad para desativar Radial** - Touch events em dispositivos Apple requerem tratamento especial
3. **Downloads de cartas muito lentos** - Ainda há gargalos no processo de download

---

## Correção 1: Restaurar Cor Laranja do Alerta PWA

**Arquivo:** `src/components/PWAUpdatePrompt.tsx`

**Problema:** O componente usa `bg-gradient-to-r from-primary to-primary/80` que resulta em cor translúcida.

**Solução:** Substituir por cores explícitas em laranja para garantir visibilidade.

```text
ANTES:
bg-gradient-to-r from-primary to-primary/80 text-primary-foreground

DEPOIS:  
bg-gradient-to-r from-amber-500 to-orange-500 text-white
```

---

## Correção 2: Touch Events para iPad (Radial VOR/NDB)

**Arquivo:** `src/components/NavigationLayer.tsx`

**Problema:** No iPad, o evento `click` do Leaflet não responde bem. Dispositivos Apple têm comportamento diferente de touch que pode causar conflitos com gesture handlers do mapa.

**Solução:** Adicionar suporte explícito a touch events + aumentar área de toque:

1. Adicionar `touchstart` e `touchend` nos eventHandlers do Marker
2. Implementar lógica para detectar "tap" (toque rápido sem arrastar)
3. Aumentar o tamanho do ícone para dispositivos touch
4. Usar `pointerEvents` para unificar mouse e touch

```typescript
// Novo handler unificado
const handlePointerUp = useCallback((e: L.LeafletMouseEvent, point: NavPoint, isVorNdb: boolean) => {
  if (!isVorNdb) return;
  
  // Prevenir propagação para evitar conflitos
  L.DomEvent.stopPropagation(e);
  
  if (selectedVor?.id === point.id) {
    setSelectedVor(null);
  } else {
    setSelectedVor(point);
  }
}, [selectedVor]);

// No Marker
eventHandlers={{
  click: (e) => handlePointerUp(e, p, isVorNdb),
  // Para iOS: adicionar handlers de touch explícitos
}}
```

Também será adicionado CSS para melhorar a responsividade em touch:

```css
.nav-point-icon {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
```

---

## Correção 3: Melhorias de Segurança na Sincronização

**Arquivos:** 
- `src/services/NavigationSyncService.ts`
- `src/services/NavigationCacheService.ts`
- `src/components/NavigationSyncButton.tsx`

**Melhorias propostas:**

### 3.1 Validação de Integridade
```typescript
interface SyncResult {
  success: boolean;
  totalPoints: number;
  byLayer: Record<string, number>;
  errors: string[];
  integrity: 'verified' | 'partial' | 'unknown';
}
```

### 3.2 Contagem Esperada por Camada
Adicionar verificação comparando quantidade baixada com quantidade esperada (baseada em downloads anteriores bem-sucedidos):

```typescript
const EXPECTED_COUNTS = {
  'ICA:airport': { min: 2000, max: 3000 },
  'ICA:heliport': { min: 500, max: 1500 },
  'ICA:vor': { min: 50, max: 200 },
  'ICA:ndb': { min: 100, max: 300 },
  'ICA:waypoint': { min: 1000, max: 5000 }
};
```

### 3.3 Alerta de Sincronização Incompleta
Se a sincronização falhar parcialmente, mostrar aviso claro ao piloto:

```
⚠️ Sincronização parcial: 3.450 de ~5.000 pontos esperados
Recomenda-se nova sincronização com conexão estável
```

---

## Correção 4: Otimização de Download de Cartas

**Arquivo:** `src/services/chartDownloader.ts`

**Problemas identificados:**
1. Timeout muito curto (4-5s) para conexões móveis
2. Retry agressivo consume tempo
3. Falta de download paralelo real com Promise.race

**Melhorias:**

### 4.1 Aumentar Concorrência e Timeout
```typescript
// Aumentar de 20 para 30 em desktop
const concurrency = isIOS ? 15 : 30;

// Aumentar timeouts
const DIRECT_TIMEOUT = 8000; // 8 segundos
const PROXY_TIMEOUT = 10000; // 10 segundos
```

### 4.2 Promise.race Real (Primeiro Sucesso)
Usar `Promise.race` corretamente para retornar assim que qualquer fonte responder:

```typescript
// ANTES: Promise.all (espera todos)
const results = await Promise.all(proxyAttempts);
if (results.some(r => r)) return true;

// DEPOIS: Promise.race + any (primeiro sucesso)
try {
  const racePromises = proxyAttempts.map(async (attempt) => {
    const result = await attempt;
    if (result) return true;
    throw new Error('Failed');
  });
  
  const first = await Promise.any(racePromises);
  if (first) return true;
} catch { /* all failed */ }
```

---

## Detalhes Técnicos

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/PWAUpdatePrompt.tsx` | Cor laranja explícita |
| `src/components/NavigationLayer.tsx` | Touch handlers para iPad |
| `src/services/chartDownloader.ts` | Otimização de concorrência |
| `src/services/NavigationSyncService.ts` | Validação de integridade |
| `src/index.css` | CSS para touch em iOS |

### Fluxo de Sincronização Proposto

```text
┌─────────────────┐
│ Iniciar Sync    │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Buscar Airport  │ ──► Salvar + Contagem
└────────┬────────┘
         ▼
┌─────────────────┐
│ Buscar Heliport │ ──► Salvar + Contagem
└────────┬────────┘
         ▼
    ... (outras camadas)
         ▼
┌─────────────────────────┐
│ Verificar Integridade   │
│ Contagem vs Esperado    │
└────────┬────────────────┘
         ▼
    ┌────┴────┐
    │ OK?     │
    └────┬────┘
    Sim  │    Não
    ▼    │    ▼
 ✅      │  ⚠️ Alerta
Complete │  Parcial
```

### Impacto em Funcionalidades Existentes

- **Modo Online**: Sem alterações - continua funcionando normalmente
- **Downloads de Cartas**: Apenas otimização, sem quebra de compatibilidade
- **Sincronização**: Adiciona validação, mantém comportamento existente
- **UI do Alerta**: Apenas mudança visual (cor)
- **Radial VOR/NDB**: Melhora em iOS sem afetar outros dispositivos
