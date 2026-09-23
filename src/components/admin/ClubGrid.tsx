import { ClubTileData } from "@/hooks/useAdminStats";
import { ClubTile } from "./ClubTile";
import { Building2, Filter } from "lucide-react";
import { useState } from "react";

interface ClubGridProps {
  clubs: ClubTileData[];
  loading?: boolean;
}

type StatusFilter = "all" | "active" | "issues" | "inactive";

export const ClubGrid = ({ clubs, loading }: ClubGridProps) => {
  const [filter, setFilter] = useState<StatusFilter>("all");

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded-lg bg-muted animate-pulse" />
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-[140px] rounded-xl bg-card border animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (clubs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <Building2 className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium">No clubs found</p>
        <p className="text-xs mt-1">Add your first club from settings.</p>
      </div>
    );
  }

  const sortedClubs = [...clubs].sort((a, b) => {
    const statusOrder = { active: 0, force_closed: 1, closed: 2, no_session: 3 };
    const statusDiff = statusOrder[a.sessionStatus] - statusOrder[b.sessionStatus];
    if (statusDiff !== 0) return statusDiff;
    if (a.issueCount !== b.issueCount) return b.issueCount - a.issueCount;
    return a.name.localeCompare(b.name);
  });

  const filteredClubs = sortedClubs.filter(club => {
    switch (filter) {
      case "active": return club.sessionStatus === "active";
      case "issues": return club.issueCount > 0;
      case "inactive": return club.sessionStatus === "no_session" || club.sessionStatus === "closed";
      default: return true;
    }
  });

  const activeCount = clubs.filter(c => c.sessionStatus === "active").length;
  const issueCount = clubs.filter(c => c.issueCount > 0).length;

  const filters: { key: StatusFilter; label: string; count?: number }[] = [
    { key: "all", label: "All", count: clubs.length },
    { key: "active", label: "Active", count: activeCount },
    { key: "issues", label: "Issues", count: issueCount },
    { key: "inactive", label: "Inactive" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Clubs</h2>
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
                filter === f.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
              {f.count !== undefined && filter !== f.key && f.count > 0 && (
                <span className="ml-1 text-[10px] opacity-60">{f.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {filteredClubs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
          <Filter className="h-5 w-5 mb-2 opacity-50" />
          <p className="text-xs">No clubs match this filter</p>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredClubs.map(club => (
            <ClubTile key={club.id} club={club} />
          ))}
        </div>
      )}
    </div>
  );
};
