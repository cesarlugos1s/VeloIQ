# Online Retail Extension Pattern

Architecture guide for adding e-commerce capabilities to VeloIQ vertical applications.

## Standards stack

| Layer | Standard | Application |
|---|---|---|
| Structural model | GoodRelations | Product (abstract) → Individual (physical) → Offering (per store) |
| Web syndication | Schema.org | Product, Offer, PriceSpecification JSON-LD |
| Identifiers | GS1 | GTIN (products), GLN (stores), EPCIS (inventory events) |
| Pricing/promotions | ARTS ODM | RetailPrice, RetailPriceModifier with `effectiveDateTime` |
| Loss prevention | NRF | Shrinkage categorization |
| Sentiment | NPS/CSAT | Net Promoter Score framework |
| Categories | UNSPSC | Global product classification taxonomy |

## Architecture: execution vs intelligence

```
JuiceMantics (intelligence)          Omnichannel Retail (execution)
┌────────────────────────┐           ┌──────────────────────────┐
│ Price optimization      │──webhook→│ ProductPrice cache        │
│ Promotion rules         │──webhook→│ ActivePromotion cache     │
│ GMROI analytics         │←─feedback│ Sales data feedback loop  │
│ Recommendation engine   │──webhook→│ ProductRecommendation     │
└────────────────────────┘           ├──────────────────────────┤
                                     │ Shopping cart + checkout  │
                                     │ Payment gateway dispatch  │
                                     │ Order state machine       │
                                     │ Customer segment resolver │
                                     └──────────────────────────┘
```

## Module structure

```
backend/app/modules/
├── online_store/          # Storefront config + price/promo cache
│   ├── models.py          # OnlineStore, OnlineStoreProduct, ProductPrice,
│   │                      #   ActivePromotion, ProductRecommendation
│   └── custom_api.py      # JM webhook receiver, product recommendations
├── shopping_cart/         # Cart and line items
│   ├── models.py          # Cart, CartItem
│   └── custom_api.py      # add-to-cart with price resolution engine
├── orders/                # Orders and fulfillment
│   ├── models.py          # Order, OrderItem
│   └── custom_api.py      # create-from-cart, confirm, ship
├── payments/              # Payment transactions
│   ├── models.py          # Payment, PaymentMethod
│   ├── gateway.py         # ABC + Stripe + PayPal adapters
│   └── custom_api.py      # authorize, capture, refund
└── customers/             # Customer profiles
    └── models.py          # OnlineStoreCustomer (segment + loyalty bridge)
```

## Payment gateway abstraction

Every gateway implements four methods:

```python
class PaymentGateway(ABC):
    def authorize(self, amount, currency, order_ref, metadata) -> GatewayResult
    def capture(self, gateway_ref) -> GatewayResult
    def refund(self, gateway_ref, amount=None) -> GatewayResult
    def handle_webhook(self, payload) -> GatewayResult
```

Gateways are configured per-store via the `PaymentMethod` CRUD page.
Adding a new gateway (Mercado Pago, Adyen, Square) requires only a new
50-line adapter class — no checkout rewrite.

## Segment-aware pricing

The `customer_segment` field on `ProductPrice` and `ActivePromotion`
supports per-segment pricing without a loyalty app:

- `None` = applies to all customers
- `"gold"` / `"premium"` = segment-specific
- `loyalty_only` flag = hidden from non-loyalty members

The `_resolve_price()` function in `shopping_cart/custom_api.py` resolves
the best price at checkout: segment-specific first, then everyone, then
fallback to `OnlineStoreProduct` base price.

## DateTime-precise windows

Per ARTS ODM `RetailPriceModifier`, all price and promotion effective
windows use `datetime` (not `date`), supporting:
- Flash sales starting at 14:00
- Hourly promotions
- Black Friday midnight rollovers
- JuiceMantics can push the entire holiday schedule weeks in advance

## Multi-store

Each online store links to a physical `RetailStore` via GS1 GLN.
Prices and promotions are store-scoped: VeloIQ US (USD) gets different
prices than VeloIQ EU (EUR).  JuiceMantics pushes per-GLN feeds.

## Standards references

- [ARTS Operational Data Model](https://www.nrf.com/arts-operational-data-model)
- [GS1 GTIN](https://www.gs1.org/standards/id-keys/gtin)
- [GS1 GLN](https://www.gs1.org/standards/id-keys/gln)
- [Schema.org Product](https://schema.org/Product)
- [GoodRelations Ontology](https://www.heppnetz.de/ontologies/goodrelations/v1)
- [UNSPSC](https://www.unspsc.org/)
- [NRF Shrinkage](https://nrf.com)
