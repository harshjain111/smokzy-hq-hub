import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Calendar, User, ImageIcon } from "lucide-react";
import { format } from "date-fns";
import PageLayout from "@/components/PageLayout";

interface PhotoRecord {
  id: string;
  photo_date: string;
  venue_id: string;
  uploaded_by: string;
  photo_url: string | null;
  venues?: { name: string } | null;
  profiles?: { full_name: string } | null;
  signed_url?: string | null;
}

interface VenueOverview {
  venue_id: string;
  venue_name: string;
  latest_photo: PhotoRecord | null;
  photo_count: number;
}

export default function CounterPictures() {
  const [view, setView] = useState<"overview" | string>("overview");
  const [overviewData, setOverviewData] = useState<VenueOverview[]>([]);
  const [venuePhotos, setVenuePhotos] = useState<PhotoRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (view === "overview") {
      fetchOverview();
    } else {
      fetchVenuePhotos(view);
    }
  }, [view]);

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      
      // Get all venues
      const { data: venues } = await supabase
        .from("venues")
        .select("id, name")
        .order("name");

      if (!venues) {
        setOverviewData([]);
        return;
      }

      // For each venue, get today's latest photo
      const overviews = await Promise.all(
        venues.map(async (venue) => {
          const { data: photos } = await supabase
            .from("closing_photos")
            .select("*")
            .eq("venue_id", venue.id)
            .eq("photo_date", today)
            .order("created_at", { ascending: false })
            .limit(1);

          const latestPhoto = photos?.[0] || null;

          // Get count of photos from last 30 days
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          
          const { count } = await supabase
            .from("closing_photos")
            .select("*", { count: "exact", head: true })
            .eq("venue_id", venue.id)
            .gte("photo_date", format(thirtyDaysAgo, "yyyy-MM-dd"));

          // If there's a photo, fetch uploader info and create signed URL
          let enrichedPhoto = null;
          if (latestPhoto) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", latestPhoto.uploaded_by)
              .single();

            // Extract file path from URL
            const extractPath = (url: string | null) => {
              if (!url) return null;
              const match = url.match(/\/closing-photos\/(.+)$/);
              return match ? match[1] : null;
            };

            const photoPath = extractPath(latestPhoto.photo_url);
            const signedUrl = photoPath
              ? (await supabase.storage.from("closing-photos").createSignedUrl(photoPath, 3600)).data?.signedUrl
              : null;

            enrichedPhoto = {
              ...latestPhoto,
              profiles: profile,
              venues: { name: venue.name },
              signed_url: signedUrl,
            };
          }

          return {
            venue_id: venue.id,
            venue_name: venue.name,
            latest_photo: enrichedPhoto,
            photo_count: count || 0,
          };
        })
      );

      setOverviewData(overviews);
    } catch (error) {
      console.error("Error fetching overview:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVenuePhotos = async (venueId: string) => {
    setLoading(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: photos, error } = await supabase
        .from("closing_photos")
        .select("*")
        .eq("venue_id", venueId)
        .gte("photo_date", format(thirtyDaysAgo, "yyyy-MM-dd"))
        .order("photo_date", { ascending: false });

      if (error) throw error;

      // Fetch venue and uploader info
      const userIds = [...new Set((photos || []).map((p) => p.uploaded_by))];
      const [venueRes, profilesRes] = await Promise.all([
        supabase.from("venues").select("id, name").eq("id", venueId).single(),
        supabase.from("profiles").select("id, full_name").in("id", userIds),
      ]);

      const profilesMap = new Map(profilesRes.data?.map((p) => [p.id, p]) || []);

      // Extract file path helper
      const extractPath = (url: string | null) => {
        if (!url) return null;
        const match = url.match(/\/closing-photos\/(.+)$/);
        return match ? match[1] : null;
      };

      const enrichedPhotos = await Promise.all(
        (photos || []).map(async (photo) => {
          const photoPath = extractPath(photo.photo_url);
          const signedUrl = photoPath
            ? (await supabase.storage.from("closing-photos").createSignedUrl(photoPath, 3600)).data?.signedUrl
            : null;

          return {
            ...photo,
            venues: venueRes.data,
            profiles: profilesMap.get(photo.uploaded_by) || null,
            signed_url: signedUrl,
          };
        })
      );

      setVenuePhotos(enrichedPhotos);
    } catch (error) {
      console.error("Error fetching venue photos:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageLayout title="Counter Pictures" subtitle="View daily counter photos from all venues">
      <div className="space-y-6">
        {/* Navigation */}
        {view !== "overview" && (
          <Button variant="outline" onClick={() => setView("overview")}>
            ← Back to Overview
          </Button>
        )}

        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading photos...</p>
          </div>
        ) : view === "overview" ? (
          /* Overview View - Today's Photos */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Today's Counter Photos</h2>
              <div className="text-sm text-muted-foreground">
                {format(new Date(), "EEEE, MMMM dd, yyyy")}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {overviewData.map((venue) => (
                <Card key={venue.venue_id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between text-lg">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        <span>{venue.venue_name}</span>
                      </div>
                      <span className="text-sm font-normal text-muted-foreground">
                        {venue.photo_count} photos (30d)
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {venue.latest_photo ? (
                      <>
                        <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
                          {venue.latest_photo.signed_url ? (
                            <img
                              src={venue.latest_photo.signed_url}
                              alt={`${venue.venue_name} counter`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="%23ddd"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23999" font-size="20">No Image</text></svg>';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="h-12 w-12 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <User className="h-4 w-4" />
                          <span>{venue.latest_photo.profiles?.full_name || "Unknown"}</span>
                        </div>
                      </>
                    ) : (
                      <div className="aspect-video w-full flex flex-col items-center justify-center bg-muted rounded-lg border border-dashed">
                        <ImageIcon className="h-12 w-12 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">No photo uploaded today</p>
                      </div>
                    )}
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setView(venue.venue_id)}
                    >
                      View All Photos ({venue.photo_count})
                    </Button>
                  </CardContent>
                </Card>
              ))}

              {overviewData.length === 0 && (
                <div className="col-span-full p-12 text-center">
                  <p className="text-muted-foreground">No venues found</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Venue Detail View - Last 30 Days */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {venuePhotos[0]?.venues?.name || "Venue"} - Last 30 Days
              </h2>
              <div className="text-sm text-muted-foreground">
                {venuePhotos.length} photos
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {venuePhotos.map((photo) => (
                <Card key={photo.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      {format(new Date(photo.photo_date), "MMM dd, yyyy")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="relative aspect-video w-full overflow-hidden rounded border bg-muted">
                      {photo.signed_url ? (
                        <img
                          src={photo.signed_url}
                          alt="Counter"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="%23ddd"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23999" font-size="16">No Image</text></svg>';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span className="truncate">{photo.profiles?.full_name || "Unknown"}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {venuePhotos.length === 0 && (
                <div className="col-span-full p-12 text-center">
                  <p className="text-muted-foreground">No photos found for this venue</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
