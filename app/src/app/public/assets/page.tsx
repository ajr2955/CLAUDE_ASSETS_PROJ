"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface PublicAsset {
  asset_name: string;
  asset_type: string | null;
  asset_family: string | null;
  neighborhood: string | null;
  status: string;
  service_start_date: string | null;
}

export default function PublicAssetsPage() {
  const [assets, setAssets] = useState<PublicAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const perPage = 25;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAssets = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), per_page: String(perPage) });
      const res = await fetch(`/api/public/assets?${params}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setAssets(json.data ?? []);
      setTotal(json.meta?.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load assets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssets(page);
  }, [fetchAssets, page]);

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="min-h-screen bg-white">
      {/* Public header */}
      <header className="bg-blue-700 text-white py-6 px-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold">Municipal Public Assets</h1>
          <p className="text-blue-200 text-sm mt-1">
            View active public facilities and services in your area
          </p>
          <div className="mt-3 flex gap-4 text-sm">
            <span className="text-blue-100 font-semibold border-b-2 border-white pb-1">Asset List</span>
            <Link href="/public/map" className="text-blue-200 hover:text-white">
              Map View
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Results info */}
        <p className="text-sm text-gray-500 mb-4">
          {loading ? "Loading..." : `Showing ${assets.length} of ${total} public assets`}
        </p>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {/* Asset table */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Asset Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Category</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Neighborhood</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">In Service Since</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!loading && assets.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-gray-400 py-12">
                    No public assets available
                  </td>
                </tr>
              )}
              {assets.map((asset, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{asset.asset_name}</td>
                  <td className="px-4 py-3 text-gray-600">{asset.asset_type ?? "—"}</td>
                  <td className="px-4 py-3">
                    {asset.asset_family && (
                      <span className="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                        {asset.asset_family}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{asset.neighborhood ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full capitalize">
                      {asset.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {asset.service_start_date
                      ? new Date(asset.service_start_date).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-gray-200 mt-12 py-6 text-center text-xs text-gray-400">
        Municipal Asset Information — Public Portal
      </footer>
    </div>
  );
}
