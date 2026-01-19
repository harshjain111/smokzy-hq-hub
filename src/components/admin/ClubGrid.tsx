import { ClubTileData } from "@/hooks/useAdminStats";
import { ClubTile } from "./ClubTile";
import { Building2 } from "lucide-react";

interface ClubGridProps {
  clubs: ClubTileData[];
  loading?: boolean;
}

export const ClubGrid = ({ clubs, loading }: ClubGridProps) => {
  if (loading) {
    return (
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-40 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (clubs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Building2 className="h-12 w-12 mb-4" />
        <p className="text-sm">No clubs found. Add your first club from settings.</p>
      </div>
    );
  }

  // Sort: active first, then by issue count (desc), then alphabetically
  const sortedClubs = [...clubs].sort((a, b) => {
    const statusOrder = { active: 0, force_closed: 1, closed: 2, no_session: 3 };
    const statusDiff = statusOrder[a.sessionStatus] - statusOrder[b.sessionStatus];
    if (statusDiff !== 0) return statusDiff;
    if (a.issueCount !== b.issueCount) return b.issueCount - a.issueCount;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Clubs</h2>
        <span className="text-xs text-muted-foreground">{clubs.length} total</span>
      </div>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {sortedClubs.map(club => (
          <ClubTile key={club.id} club={club} />
        ))}
      </div>
    </div>
  );
};
