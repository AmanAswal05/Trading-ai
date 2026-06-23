# Trading AI Analyser

Trading AI Analyser is a comprehensive web application to analyze stock market data, perform backtesting, and view market trends.

## Features
- Real-time or Demo market data options.
- News sentiment analysis.
- Advanced charting and analytics.

## Getting Started

First, install dependencies:
```bash
npm install
```

Then, run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Troubleshooting

### How to fix "Backtest Failed: Missing prediction columns"
If you see an error that your database is missing prediction columns, you need to apply the latest migrations to your Supabase instance.

**Exact Steps:**
1. Open your [Supabase Dashboard](https://app.supabase.com/).
2. Select your project.
3. Click on **SQL Editor** in the left sidebar.
4. Click **New query**.
5. Copy the entire contents of the `migrations/20260623_supabase_manual_fix.sql` file.
6. Paste it into the Supabase SQL Editor and click **Run**.
7. Reload your application. The missing columns will be added and the backtest engine will now work.
