# Project Structure

```text
src/
  catalog/    tools, shelves, search
  loans/      lending, returns, fees
  members/    sign-up, standing
  counter/    the counter page
```

Each folder owns its tables; another folder reads them through that folder's functions only.
