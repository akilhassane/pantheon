export default function ImaginePage() {
  return (
    <div className="min-h-screen bg-[#101218] text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold">Imagine</h1>
          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-medium rounded-full border border-blue-500/30">
            NEW
          </span>
        </div>
        <p className="text-gray-400 mb-8">AI-powered image generation</p>
        
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
          <p className="text-gray-300 mb-4">
            Create stunning images with AI. This feature is coming soon!
          </p>
          <div className="flex gap-2">
            <div className="w-32 h-32 bg-slate-800 rounded-lg border border-slate-700 flex items-center justify-center">
              <span className="text-gray-600 text-sm">Preview</span>
            </div>
            <div className="w-32 h-32 bg-slate-800 rounded-lg border border-slate-700 flex items-center justify-center">
              <span className="text-gray-600 text-sm">Preview</span>
            </div>
            <div className="w-32 h-32 bg-slate-800 rounded-lg border border-slate-700 flex items-center justify-center">
              <span className="text-gray-600 text-sm">Preview</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
