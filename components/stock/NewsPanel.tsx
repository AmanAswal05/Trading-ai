'use client';

import { NewsArticle } from '@/types/stock';
import { formatTimeAgo } from '@/lib/format';
import { ExternalLink, MessageSquare } from 'lucide-react';

interface NewsPanelProps {
  articles: NewsArticle[];
}

export default function NewsPanel({ articles }: NewsPanelProps) {
  const sentimentStyles = {
    positive: 'bg-accent-green/12 text-accent-green border-accent-green/25',
    negative: 'bg-accent-red/12 text-accent-red border-accent-red/25',
    neutral: 'bg-bg-secondary text-text-secondary border-border-custom',
  };

  return (
    <div className="p-5 border border-border-custom bg-bg-card rounded-xl transition-theme">
      <div className="flex items-center justify-between mb-4 border-b border-border-custom pb-3.5">
        <div>
          <h3 className="text-sm font-bold text-text-primary">Market Sentiment News</h3>
          <p className="text-xs text-text-secondary">Recent headlines categorized by sentiment impact</p>
        </div>
        <span className="text-[10px] font-mono font-bold bg-bg-secondary px-2 py-0.5 rounded text-text-muted border border-border-custom">
          {articles.length} HEADLINES
        </span>
      </div>

      {articles.length === 0 ? (
        <div className="p-8 text-center text-xs text-text-secondary">
          <MessageSquare className="w-5 h-5 mx-auto text-text-muted mb-2 opacity-50" />
          No recent articles found.
        </div>
      ) : (
        <div className="divide-y divide-border-custom/50">
          {articles.map((art, idx) => (
            <div
              key={idx}
              className="py-3.5 first:pt-0 last:pb-0 hover:bg-bg-card-hover px-1.5 -mx-1.5 rounded-lg transition-colors group"
            >
              <div className="flex items-start justify-between gap-4 mb-1.5">
                <a
                  href={art.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-text-primary hover:text-accent-blue transition-colors leading-snug flex-1 pr-1"
                >
                  {art.title}
                </a>
                
                <span
                  className={`inline-block px-2 py-0.5 rounded border text-[9px] font-mono font-bold tracking-wider leading-none uppercase ${
                    sentimentStyles[art.sentiment] || sentimentStyles.neutral
                  }`}
                >
                  {art.sentiment}
                </span>
              </div>
              
              <div className="flex items-center justify-between text-[10px] font-mono text-text-muted">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-text-secondary">{art.source}</span>
                  <span>•</span>
                  <span>{formatTimeAgo(art.publishedAt)}</span>
                </div>
                
                <a
                  href={art.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-accent-blue font-bold hover:underline transition-opacity"
                >
                  Read
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
