# exchange-rate

USD → BRL rate, no API key needed.

## Status: 🟢 active

Uses [Frankfurter](https://frankfurter.dev) (free, no key, ECB-sourced daily rates). Refreshes hourly — exchange rates don't need to be more real-time than that for this use case, and Frankfurter's rates themselves only update once a day anyway (ECB reference rates). Shows current rate both directions plus 7-day change.

To track a different currency pair, change `BASE`/`TARGET` at the top of `collector.js`.
