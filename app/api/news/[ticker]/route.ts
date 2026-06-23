/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { NewsArticle } from '@/types/stock';

export const dynamic = 'force-dynamic';

function getSentiment(title: string): 'positive' | 'negative' | 'neutral' {
  return 'neutral';
}

function generateMockNews(ticker: string): NewsArticle[] {
  const cleanTicker = ticker.toUpperCase();
  const companyNames: Record<string, string> = {
    AAPL: 'Apple Inc.',
    MSFT: 'Microsoft Corp.',
    GOOGL: 'Alphabet Inc.',
    TSLA: 'Tesla Inc.',
    AMZN: 'Amazon.com Inc.',
    'RELIANCE.BSE': 'Reliance Industries',
    NIFTY: 'NIFTY 50 Index',
  };
  const name = companyNames[cleanTicker] || `${cleanTicker} Corp.`;

  const templates = [
    {
      title: `${name} stock surges as earnings beat expectations`,
      source: 'Reuters',
      hoursAgo: 2,
    },
    {
      title: `Analysts upgrade ${cleanTicker} citing growth catalyst in AI`,
      source: 'Bloomberg',
      hoursAgo: 5,
    },
    {
      title: `${name} faces supply chain headwinds and volume decline warnings`,
      source: 'Wall Street Journal',
      hoursAgo: 8,
    },
    {
      title: `Institutional buying hits record levels for ${cleanTicker}`,
      source: 'Financial Times',
      hoursAgo: 12,
    },
    {
      title: `Tech stocks fluctuate, leading to minor dip in ${name}`,
      source: 'CNBC',
      hoursAgo: 18,
    },
    {
      title: `Retail interest gains momentum in ${cleanTicker} ahead of product launch`,
      source: 'MarketWatch',
      hoursAgo: 24,
    },
    {
      title: `${name} expansion plans suggest higher long-term market share`,
      source: 'Forbes',
      hoursAgo: 30,
    },
    {
      title: `CEO outlines ${name} roadmap for sustainable energy and cloud integration`,
      source: 'TechCrunch',
      hoursAgo: 36,
    },
  ];

  return templates.map((t) => {
    const pubDate = new Date();
    pubDate.setHours(pubDate.getHours() - t.hoursAgo);
    return {
      title: t.title,
      source: t.source,
      url: `https://finance.yahoo.com/quote/${cleanTicker}`,
      publishedAt: pubDate.toISOString(),
      sentiment: getSentiment(t.title),
    };
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.toUpperCase();
  const apiKey = process.env.NEWS_API_KEY;

  if (apiKey && apiKey !== 'your_newsapi_key') {
    try {
      const url = `https://newsapi.org/v2/everything?q=${ticker}&language=en&sortBy=publishedAt&pageSize=8&apiKey=${apiKey}`;
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();

      if (data && data.articles) {
        const articles: NewsArticle[] = data.articles.map((art: any) => ({
          title: art.title,
          source: art.source?.name || 'News',
          url: art.url,
          publishedAt: art.publishedAt || new Date().toISOString(),
          sentiment: getSentiment(art.title),
        }));
        return NextResponse.json({ articles });
      }
    } catch (err) {
      console.error(`Error querying NewsAPI for ticker ${ticker}:`, err);
    }
  }

  // Fallback to mock news
  return NextResponse.json({ articles: generateMockNews(ticker) });
}
