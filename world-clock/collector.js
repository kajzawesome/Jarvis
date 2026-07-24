// Add/remove zones here. `tz` must be a valid IANA timezone name.
const ZONES = [
  { label: 'HERE', tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
  { label: 'BRAZIL', tz: 'America/Sao_Paulo' },
];

async function getClocks() {
  const now = new Date();
  const zones = ZONES.map((z) => {
    const timeFmt = new Intl.DateTimeFormat('en-US', { timeZone: z.tz, hour: '2-digit', minute: '2-digit', hour12: false });
    const dateFmt = new Intl.DateTimeFormat('en-US', { timeZone: z.tz, weekday: 'short', month: 'short', day: 'numeric' });
    return { label: z.label, tz: z.tz, time: timeFmt.format(now), date: dateFmt.format(now) };
  });

  return {
    name: 'world-clock',
    state: 'ok',
    metrics: { zones },
    lastUpdated: new Date().toISOString(),
  };
}

module.exports = { getClocks };
