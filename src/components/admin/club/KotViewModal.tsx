import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Image, FileX, Loader2, Eye, Download } from "lucide-react";
import { format } from "date-fns";

interface KotViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  sessionDate: string;
}

interface KotEntry {
  id: string;
  entry_type: 'photo' | 'no_kot_declared';
  photo_url?: string;
  declaration_reason?: string;
  declaration_note?: string;
  created_at: string;
  user_id: string;
}

interface Profile {
  id: string;
  full_name: string;
}

const REASON_LABELS: Record<string, string> = {
  'club_denied_kot': 'Club denied KOT',
  'kot_not_provided': 'KOT not provided by counter',
  'system_issue': 'System / printer issue',
  'other': 'Other',
};

const KotViewModal = ({ open, onOpenChange, sessionId, sessionDate }: KotViewModalProps) => {
  const [entries, setEntries] = useState<KotEntry[]>([]);
  const [profiles, setProfiles] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    if (open && sessionId) {
      fetchEntries();
    }
  }, [open, sessionId]);

  const fetchEntries = async () => {
    setLoading(true);
    
    const { data } = await supabase
      .from("kot_entries")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (data) {
      setEntries(data as KotEntry[]);
      
      // Fetch profiles for all users
      const userIds = [...new Set(data.map(e => e.user_id))];
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        
        if (profilesData) {
          const profileMap = new Map(profilesData.map(p => [p.id, p.full_name]));
          setProfiles(profileMap);
        }
      }
    }
    
    setLoading(false);
  };

  const photoEntries = entries.filter(e => e.entry_type === 'photo');
  const declarations = entries.filter(e => e.entry_type === 'no_kot_declared');

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Image className="w-5 h-5 text-primary" />
              KOT Proof - {format(new Date(sessionDate), 'MMM d, yyyy')}
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No KOT entries for this session
            </div>
          ) : (
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-6 pb-4">
                {/* Photo Entries */}
                {photoEntries.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                      <Image className="w-4 h-4" />
                      KOT Photos ({photoEntries.length})
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {photoEntries.map(entry => (
                        <div
                          key={entry.id}
                          className="relative group rounded-lg overflow-hidden border border-border bg-muted/30"
                        >
                          <img
                            src={entry.photo_url}
                            alt="KOT"
                            className="w-full aspect-[4/3] object-cover cursor-pointer"
                            onClick={() => setSelectedImage(entry.photo_url || null)}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <Button
                              size="icon"
                              variant="secondary"
                              className="h-8 w-8"
                              onClick={() => setSelectedImage(entry.photo_url || null)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="p-2 bg-background/95">
                            <p className="text-xs font-medium truncate">
                              {profiles.get(entry.user_id) || 'Unknown'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(entry.created_at), 'h:mm a')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Declarations */}
                {declarations.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                      <FileX className="w-4 h-4" />
                      No KOT Declarations ({declarations.length})
                    </h3>
                    <div className="space-y-2">
                      {declarations.map(entry => (
                        <div
                          key={entry.id}
                          className="p-3 rounded-lg border border-warning/30 bg-warning/5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium">
                                {REASON_LABELS[entry.declaration_reason || ''] || entry.declaration_reason}
                              </p>
                              {entry.declaration_note && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  "{entry.declaration_note}"
                                </p>
                              )}
                            </div>
                            <Badge variant="outline" className="shrink-0 text-xs">
                              {profiles.get(entry.user_id) || 'Unknown'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            {format(new Date(entry.created_at), 'MMM d, h:mm a')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Full Image View Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl">
          <div className="relative">
            <img
              src={selectedImage || ''}
              alt="KOT Full View"
              className="w-full max-h-[85vh] object-contain"
            />
            <Button
              size="icon"
              variant="secondary"
              className="absolute top-2 right-2"
              onClick={() => {
                if (selectedImage) {
                  window.open(selectedImage, '_blank');
                }
              }}
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default KotViewModal;
