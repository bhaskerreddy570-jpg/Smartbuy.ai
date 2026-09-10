export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">AI & Recommendation Settings</h1>
      <div className="admin-card space-y-4">
        <div>
          <label className="text-sm font-medium">Customer value weight</label>
          <p className="text-2xl font-bold text-emerald-600">75%</p>
        </div>
        <div>
          <label className="text-sm font-medium">Business/affiliate weight</label>
          <p className="text-2xl font-bold">25%</p>
        </div>
        <div>
          <label className="text-sm font-medium">Match confidence threshold</label>
          <p className="text-2xl font-bold">0.85</p>
        </div>
        <p className="text-sm text-zinc-500">
          Configurable via SystemSetting table. Customer satisfaction dominates recommendations.
        </p>
      </div>
    </div>
  );
}
