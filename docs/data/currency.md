# Schema: Currency

> **Produziert von:** -
> **Konsumiert von:** [Shop](shop.md) (Preise), [Party](../features/Character-System.md) (Gold)

D&D 5e Waehrungstypen fuer Preise und Vermoegen.

---

## Felder

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| - | `'cp' \| 'sp' \| 'ep' \| 'gp' \| 'pp'` | D&D 5e Waehrungstyp | Enum-Wert |

---

## Werte

| Kuerzel | Name | Wert in GP |
|---------|------|------------|
| `cp` | Copper Piece | 0.01 |
| `sp` | Silver Piece | 0.1 |
| `ep` | Electrum Piece | 0.5 |
| `gp` | Gold Piece | 1 |
| `pp` | Platinum Piece | 10 |

---

## Invarianten

- Nur die 5 definierten Werte sind gueltig
- Umrechnung erfolgt immer ueber GP als Basiseinheit

---

## Beispiel

```typescript
type Currency = 'cp' | 'sp' | 'ep' | 'gp' | 'pp';

const price: { amount: number; currency: Currency } = {
  amount: 50,
  currency: 'gp'
};
```
