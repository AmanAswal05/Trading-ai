/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */

import React from 'react';
import { Users, CreditCard, Percent, BarChart3, Database, Activity, ArrowUpRight, Search } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { DashboardStats, TickerVolume, PaymentRecord, SubscriptionRecord } from '@/lib/admin/types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function MetricsTab(props: any) {
  const {
    stats, tickerVolumes, recentPayments, recentSubscriptions, 
    dbActiveTab, setDbActiveTab,
    revenueTrendData, convertedRevenueTrendData, convert, symbol, formatConvertedPrice, decimalPlaces, formatPrice, convertToUsd
  } = props;

  return (
    <>
      {/* TAB 2: DATABASE STATS & METRICS */}
      
        <div className="space-y-6">
          
          {/* Metric Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4.5">
            {/* Total Users */}
            <div className="p-4 border border-border-custom bg-bg-card rounded-xl flex items-center justify-between transition-theme shadow-sm">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-wider">
                  Total Accounts
                </span>
                <p className="text-xl font-bold text-text-primary">{stats.totalUsers}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-accent-blue/10 text-accent-blue flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </div>

            {/* Active Trials */}
            <div className="p-4 border border-border-custom bg-bg-card rounded-xl flex items-center justify-between transition-theme shadow-sm">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-wider">
                  Active Trials
                </span>
                <p className="text-xl font-bold text-text-primary">{stats.activeTrials}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-accent-blue/10 text-accent-blue flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
            </div>

            {/* Paid Users */}
            <div className="p-4 border border-border-custom bg-bg-card rounded-xl flex items-center justify-between transition-theme shadow-sm">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-wider">
                  Active Pro Users
                </span>
                <p className="text-xl font-bold text-text-primary">{stats.paidUsers}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-accent-blue/10 text-accent-blue flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5" />
              </div>
            </div>

            {/* Conversion rate */}
            <div className="p-4 border border-border-custom bg-bg-card rounded-xl flex items-center justify-between transition-theme shadow-sm">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-wider">
                  Conversion Index
                </span>
                <p className="text-xl font-bold text-text-primary">{stats.conversionRate}%</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-accent-blue/10 text-accent-blue flex items-center justify-center">
                <Percent className="w-5 h-5" />
              </div>
            </div>

            {/* Total Revenue */}
            <div className="p-4 border border-border-custom bg-bg-card rounded-xl flex items-center justify-between transition-theme shadow-sm">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-wider">
                  Gross Revenue
                </span>
                <p className="text-xl font-bold text-accent-blue">
                  {formatPrice(stats.totalRevenue)}
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-accent-blue/10 text-accent-blue flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Chart Layout: Search Volume vs Cumulative Sales */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Search volumes (7 cols) */}
            <div className="lg:col-span-7 p-5 border border-border-custom bg-bg-card rounded-xl transition-theme space-y-4 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                  <Search className="w-4 h-4 text-accent-blue" /> Most Queried Tickers
                </h3>
                <p className="text-xs text-text-secondary">Distribution of search logs by stock symbol</p>
              </div>

              <div className="h-64 mt-4 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tickerVolumes}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                    <XAxis 
                      dataKey="ticker" 
                      stroke="var(--text-muted)" 
                      fontSize={10} 
                      fontFamily="monospace"
                      tickLine={false} 
                    />
                    <YAxis 
                      stroke="var(--text-muted)" 
                      fontSize={10} 
                      fontFamily="monospace"
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'var(--bg-card)', 
                        borderColor: 'var(--border)', 
                        borderRadius: '12px',
                        fontSize: '11px',
                        color: 'var(--text-primary)'
                      }} 
                    />
                    <Bar dataKey="volume" fill="var(--accent-blue)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Revenue progress (5 cols) */}
            <div className="lg:col-span-5 p-5 border border-border-custom bg-bg-card rounded-xl transition-theme space-y-4 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-accent-blue" /> Cumulative Sales Trend
                </h3>
                <p className="text-xs text-text-secondary">Gross sales progression index over time</p>
              </div>

              <div className="h-64 mt-4 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={convertedRevenueTrendData}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent-blue)" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="var(--accent-blue)" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      stroke="var(--text-muted)" 
                      fontSize={10} 
                      fontFamily="monospace"
                      tickLine={false} 
                    />
                    <YAxis 
                      stroke="var(--text-muted)" 
                      fontSize={10} 
                      fontFamily="monospace"
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(val) => formatConvertedPrice(val)}
                    />
                    <Tooltip 
                      formatter={(value) => [formatConvertedPrice(Number(value)), 'Cumulative Revenue']}
                      contentStyle={{ 
                        backgroundColor: 'var(--bg-card)', 
                        borderColor: 'var(--border)', 
                        borderRadius: '12px',
                        fontSize: '11px',
                        color: 'var(--text-primary)'
                      }} 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="var(--accent-blue)" 
                      fillOpacity={1} 
                      fill="url(#colorRevenue)" 
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Database Tables Section */}
          <div className="p-5 border border-border-custom bg-bg-card rounded-xl transition-theme space-y-4 shadow-sm">
            
            {/* Tab Controls */}
            <div className="flex items-center justify-between border-b border-border-custom pb-3">
              <div className="flex gap-4">
                <button
                  onClick={() => setDbActiveTab('payments')}
                  className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 cursor-pointer transition-all ${
                    dbActiveTab === 'payments'
                      ? 'border-accent-blue text-text-primary'
                      : 'border-transparent text-text-muted hover:text-text-secondary'
                  }`}
                >
                  Recent Transactions
                </button>
                <button
                  onClick={() => setDbActiveTab('subscriptions')}
                  className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 cursor-pointer transition-all ${
                    dbActiveTab === 'subscriptions'
                      ? 'border-accent-blue text-text-primary'
                      : 'border-transparent text-text-muted hover:text-text-secondary'
                  }`}
                >
                  Recent Subscriptions
                </button>
              </div>
              <span className="text-[10px] font-mono font-bold text-text-muted">
                Showing last 10 entries
              </span>
            </div>

            {/* Tab Contents: Payments Table */}
            {dbActiveTab === 'payments' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border-custom text-text-muted font-mono uppercase text-[9px] tracking-wider">
                      <th className="py-2.5 font-bold">Transaction ID</th>
                      <th className="py-2.5 font-bold">User Email</th>
                      <th className="py-2.5 font-bold">Amount</th>
                      <th className="py-2.5 font-bold">Provider</th>
                      <th className="py-2.5 font-bold">Status</th>
                      <th className="py-2.5 font-bold">Created At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-custom/50 text-text-secondary font-mono">
                    {recentPayments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-text-muted">
                          No transactions recorded in payments table
                        </td>
                      </tr>
                    ) : (
                      recentPayments.map((pay: any) => (
                        <tr key={pay.id} className="hover:bg-table-row-hover">
                          <td className="py-2.5 font-semibold text-text-primary">{pay.id.substring(0, 14)}...</td>
                          <td className="py-2.5">{pay.user_email}</td>
                          <td className="py-2.5 font-bold text-text-primary">
                            {formatPrice(convertToUsd(pay.amount, pay.currency))}
                          </td>
                          <td className="py-2.5">{pay.provider}</td>
                          <td className="py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              pay.status === 'Success' 
                                ? 'bg-accent-green/10 text-accent-green border border-accent-green/25' 
                                : 'bg-accent-red/10 text-accent-red border border-accent-red/25'
                            }`}>
                              {pay.status}
                            </span>
                          </td>
                          <td className="py-2.5 text-text-muted">{new Date(pay.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab Contents: Subscriptions Table */}
            {dbActiveTab === 'subscriptions' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border-custom text-text-muted font-mono uppercase text-[9px] tracking-wider">
                      <th className="py-2.5 font-bold">Subscription ID</th>
                      <th className="py-2.5 font-bold">User Email</th>
                      <th className="py-2.5 font-bold">Plan</th>
                      <th className="py-2.5 font-bold">Billing Cycle</th>
                      <th className="py-2.5 font-bold">Status</th>
                      <th className="py-2.5 font-bold">Expiry Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-custom/50 text-text-secondary font-mono">
                    {recentSubscriptions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-text-muted">
                          No active subscription records found
                        </td>
                      </tr>
                    ) : (
                      recentSubscriptions.map((sub: any) => (
                        <tr key={sub.id} className="hover:bg-table-row-hover">
                          <td className="py-2.5 font-semibold text-text-primary">{sub.id.substring(0, 14)}...</td>
                          <td className="py-2.5">{sub.user_email}</td>
                          <td className="py-2.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              sub.plan_name === 'Pro' 
                                ? 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20' 
                                : 'bg-bg-secondary text-text-secondary'
                            }`}>
                              {sub.plan_name}
                            </span>
                          </td>
                          <td className="py-2.5">{sub.billing_cycle}</td>
                          <td className="py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              sub.status === 'Active' 
                                ? 'bg-accent-green/10 text-accent-green border border-accent-green/25' 
                                : 'bg-accent-red/10 text-accent-red border border-accent-red/25'
                            }`}>
                              {sub.status}
                            </span>
                          </td>
                          <td className="py-2.5 text-text-muted">{new Date(sub.end_date).toLocaleDateString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

          </div>

        </div>

    </>
  );
}
