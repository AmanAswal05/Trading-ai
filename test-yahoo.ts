import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

async function run() {
  try {
    const chart = await yahooFinance.chart('AAPL', {
      period1: '2023-01-01',
      interval: '1d',
    });
    console.log(`Length: ${chart?.quotes?.length}`);
    if (chart?.quotes?.length) {
      console.log('First:', chart.quotes[0]);
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

run();
