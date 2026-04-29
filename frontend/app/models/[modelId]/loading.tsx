export default function ModelLoading() {
  return (
    <main className="app-shell min-h-screen p-4 sm:p-6">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
        <div className="panel-surface h-28 animate-pulse rounded-[28px]" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <div className="panel-surface h-[640px] animate-pulse rounded-[28px]" />
          <div className="panel-surface h-[640px] animate-pulse rounded-[28px]" />
        </div>
      </div>
    </main>
  );
}
