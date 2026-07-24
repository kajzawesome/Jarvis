const BASE = 'USD';
const TARGET = 'BRL';

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

async function getRate() {
  try {
    const [current, weekAgo] = await Promise.all([
      fetch(`https://api.frankfurter.app/latest?base=${BASE}&symbols=${TARGET}`).then((r) => r.json()),
      fetch(`https://api.frankfurter.app/${daysAgo(7)}?base=${BASE}&symbols=${TARGET}`).then((r) => r.json()),
    ]);

    const rate = current.rates[TARGET];
    const previous = weekAgo.rates[TARGET];
    const changePct = previous ? ((rate - previous) / previous) * 100 : null;

    return {
      name: 'exchange-rate',
      state: 'ok',
      metrics: {
        rate,
        inverse: 1 / rate,
        date: current.date,
        change_pct_7d: changePct != null ? Math.round(changePct * 100) / 100 : null,
      },
      lastUpdated: new Date().toISOString(),
    };
  } catch (err) {
    return {
      name: 'exchange-rate',
      state: 'error',
      metrics: { error: err.message },
      lastUpdated: new Date().toISOString(),
    };
  }
}

module.exports = { getRate };
