# Architecture rules

- Subscription access uses account scope with a legacy owner fallback and an unexpired active status, shared across UI and jobs, so paid accounts are recognized consistently.
- Kiwify callbacks validate HMAC-SHA1 over the untouched request body, as required by the provider.
- Payment reconciliation never rewrites settled records or links different email addresses automatically, preserving purchase history and account ownership.