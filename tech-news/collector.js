const STORY_COUNT = 8;

async function getStories() {
  try {
    const idsRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    const ids = (await idsRes.json()).slice(0, STORY_COUNT);

    const items = await Promise.all(
      ids.map((id) => fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then((r) => r.json()))
    );

    return {
      name: 'tech-news',
      state: 'ok',
      metrics: {
        stories: items.map((i) => ({
          title: i.title,
          score: i.score,
          comments: i.descendants || 0,
          url: i.url || `https://news.ycombinator.com/item?id=${i.id}`,
        })),
      },
      lastUpdated: new Date().toISOString(),
    };
  } catch (err) {
    return { name: 'tech-news', state: 'error', metrics: { error: err.message }, lastUpdated: new Date().toISOString() };
  }
}

module.exports = { getStories };
