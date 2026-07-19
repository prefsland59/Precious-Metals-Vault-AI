import { useState } from 'react';

type Tab = 'dashboard' | 'portfolio' | 'add' | 'vaults' | 'settings';

const NAV_ITEMS: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'portfolio', label: 'Portfolio', icon: '🏦' },
  { id: 'add', label: 'Add Item', icon: '➕' },
  { id: 'vaults', label: 'Vaults', icon: '🔒' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  return (
    <div className="flex h-screen bg-black">
      {/* ─── Sidebar ─────────────────────────────────────────── */}
      <aside className="w-64 flex flex-col border-r border-charcoal-light bg-charcoal">
        {/* Logo */}
        <div className="px-5 py-6 border-b border-charcoal-light">
          <h1 className="text-lg font-bold tracking-tight">
            <span className="text-gold">Precious Metals</span>
            <br />
            <span className="text-platinum">Vault AI</span>
          </h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-5 py-3 text-sm transition-colors ${
                activeTab === item.id
                  ? 'bg-gold/10 text-gold border-r-2 border-gold'
                  : 'text-silver hover:text-platinum hover:bg-surface-hover'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-charcoal-light">
          <p className="text-xs text-silver-dark">
            v0.1.0 — Free Tier
          </p>
        </div>
      </aside>

      {/* ─── Main Content ────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <TabContent tab={activeTab} />
      </main>
    </div>
  );
}

function TabContent({ tab }: { tab: Tab }) {
  switch (tab) {
    case 'dashboard':
      return <DashboardPage />;
    case 'portfolio':
      return <PlaceholderPage title="Portfolio" description="Your precious metals holdings will appear here." />;
    case 'add':
      return <PlaceholderPage title="Add Item" description="Add holdings manually or use AI camera scan." />;
    case 'vaults':
      return <PlaceholderPage title="Vaults" description="Manage your storage locations." />;
    case 'settings':
      return <PlaceholderPage title="Settings" description="Account preferences and subscription management." />;
  }
}

function DashboardPage() {
  return (
    <div className="p-8">
      <h2 className="text-2xl font-semibold text-platinum mb-2">Dashboard</h2>
      <p className="text-silver-dark mb-8">Portfolio overview and market insights</p>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Value" value="$12,450.00" change="+2.4%" positive />
        <StatCard label="Gold" value="$8,200.00" change="+0.8%" positive />
        <StatCard label="Silver" value="$3,150.00" change="+5.2%" positive />
        <StatCard label="Platinum" value="$1,100.00" change="-1.2%" positive={false} />
      </div>

      {/* Spot Prices */}
      <div className="bg-charcoal border border-charcoal-light rounded-lg p-6">
        <h3 className="text-lg font-medium text-platinum mb-4">Live Spot Prices</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { metal: 'Gold', price: '$2,420.50', change: '+0.3%' },
            { metal: 'Silver', price: '$29.87', change: '+1.1%' },
            { metal: 'Platinum', price: '$985.30', change: '-0.5%' },
            { metal: 'Palladium', price: '$925.00', change: '+2.0%' },
          ].map((spot) => (
            <div key={spot.metal} className="text-center p-3 rounded bg-surface-hover">
              <p className="text-xs text-silver-dark uppercase tracking-wider mb-1">{spot.metal}</p>
              <p className="text-xl font-semibold text-platinum">{spot.price}</p>
              <p className={`text-xs ${spot.change.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                {spot.change}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, change, positive }: { label: string; value: string; change: string; positive: boolean }) {
  return (
    <div className="bg-charcoal border border-charcoal-light rounded-lg p-5 hover:border-gold/30 transition-colors">
      <p className="text-xs text-silver-dark uppercase tracking-wider mb-2">{label}</p>
      <p className="text-2xl font-bold text-platinum mb-1">{value}</p>
      <p className={`text-sm ${positive ? 'text-green-400' : 'text-red-400'}`}>{change}</p>
    </div>
  );
}

function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mb-6">
        <span className="text-2xl">🏗️</span>
      </div>
      <h2 className="text-2xl font-semibold text-platinum mb-2">{title}</h2>
      <p className="text-silver-dark max-w-md">{description}</p>
      <p className="text-xs text-silver-dark/50 mt-4">Coming soon</p>
    </div>
  );
}
