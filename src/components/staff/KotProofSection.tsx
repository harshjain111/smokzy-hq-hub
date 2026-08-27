import { useState, useRef, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Camera, ImagePlus, FileX, Check, Loader2, X, Info } from "lucide-react";
import { compressImage } from "@/lib/imageCompression";

const getUploadExtension = (file: File) => {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/heic" || file.type === "image/heif") return "heic";
  return "jpg";
};

interface KotProofSectionProps {
  user: User;
  venueId: string;
  sessionId: string;
}

interface KotEntry {
  id: string;
  entry_type: 'photo' | 'no_kot_declared';
  photo_url?: string;
  declaration_reason?: string;
  declaration_note?: string;
  created_at: string;
  user_id: string;
  profiles?: { full_name: string };
}

const DECLARATION_REASONS = [
  { value: 'club_denied_kot', label: 'Club denied KOT' },
  { value: 'kot_not_provided', label: 'KOT not provided by counter' },
  { value: 'system_issue', label: 'System / printer issue' },
  { value: 'other', label: 'Other' },
];

const KotProofSection = ({ user, venueId, sessionId }: KotProofSectionProps) => {
  const [kotEntries, setKotEntries] = useState<KotEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showNoKotDialog, setShowNoKotDialog] = useState(false);
  const [declarationReason, setDeclarationReason] = useState("");
  const [declarationNote, setDeclarationNote] = useState("");
  const [declaring, setDeclaring] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Fetch existing KOT entries for this session
  const fetchKotEntries = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("kot_entries")
      .select("id, entry_type, photo_url")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false });
    
    if (data) {
      setKotEntries(data as KotEntry[]);
    }
    setLoading(false);
  };

  // Fetch on mount
  useEffect(() => {
    if (sessionId) {
      fetchKotEntries();
    }
  }, [sessionId]);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Compress with aggressive settings to avoid memory issues on mobile
        const uploadFile = await compressImage(file, {
          maxWidth: 1280,
          maxHeight: 1280,
          quality: 0.6,
          maxSizeMB: 0.5,
        });
        
        // Generate unique filename — first folder must be user.id to match storage policy
        const timestamp = Date.now();
        const extension = getUploadExtension(uploadFile);
        const filename = `${user.id}/${venueId}_${sessionId}_${timestamp}_${i}.${extension}`;
        
        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("kot-photos")
          .upload(filename, uploadFile, {
            contentType: uploadFile.type || "image/jpeg",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        // Get signed URL (bucket is private)
        const { data: urlData, error: urlError } = await supabase.storage
          .from("kot-photos")
          .createSignedUrl(filename, 60 * 60 * 24 * 365); // 1 year

        if (urlError || !urlData?.signedUrl) throw urlError || new Error("Failed to get signed URL");

        // Create KOT entry
        const { error: entryError } = await supabase
          .from("kot_entries")
          .insert({
            venue_id: venueId,
            session_id: sessionId,
            user_id: user.id,
            entry_type: 'photo',
            photo_url: urlData.signedUrl,
          });

        if (entryError) throw entryError;
      }

      toast.success(`${files.length} KOT photo${files.length > 1 ? 's' : ''} uploaded`);
      await fetchKotEntries();
    } catch (error: any) {
      console.error("KOT upload error:", error);
      toast.error(error.message || "Failed to upload KOT photo");
    } finally {
      setUploading(false);
      // Reset file inputs
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const handleNoKotDeclaration = async () => {
    if (!declarationReason) {
      toast.error("Please select a reason");
      return;
    }

    setDeclaring(true);
    try {
      const { error } = await supabase
        .from("kot_entries")
        .insert({
          venue_id: venueId,
          session_id: sessionId,
          user_id: user.id,
          entry_type: 'no_kot_declared',
          declaration_reason: declarationReason,
          declaration_note: declarationNote.trim() || null,
        });

      if (error) throw error;

      toast.success("No KOT declaration recorded");
      setShowNoKotDialog(false);
      setDeclarationReason("");
      setDeclarationNote("");
      await fetchKotEntries();
    } catch (error: any) {
      console.error("Declaration error:", error);
      toast.error(error.message || "Failed to record declaration");
    } finally {
      setDeclaring(false);
    }
  };

  const photoCount = kotEntries.filter(e => e.entry_type === 'photo').length;
  const hasDeclaration = kotEntries.some(e => e.entry_type === 'no_kot_declared');

  return (
    <div className="bg-muted/30 rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">KOT Proof</h3>
          {photoCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {photoCount} photo{photoCount > 1 ? 's' : ''}
            </Badge>
          )}
          {hasDeclaration && (
            <Badge variant="outline" className="text-xs text-warning border-warning/30">
              No KOT Declared
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">Optional</span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        {/* Camera capture */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFileUpload(e.target.files)}
          multiple
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => cameraInputRef.current?.click()}
          disabled={uploading}
          className="flex-1 h-11 rounded-xl"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Camera className="w-4 h-4 mr-2" />
          )}
          Camera
        </Button>

        {/* Gallery upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFileUpload(e.target.files)}
          multiple
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex-1 h-11 rounded-xl"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <ImagePlus className="w-4 h-4 mr-2" />
          )}
          Gallery
        </Button>

        {/* No KOT button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowNoKotDialog(true)}
          disabled={uploading}
          className="flex-1 h-11 rounded-xl text-muted-foreground"
        >
          <FileX className="w-4 h-4 mr-2" />
          No KOT
        </Button>
      </div>

      {/* Preview of uploaded photos */}
      {kotEntries.filter(e => e.entry_type === 'photo').length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {kotEntries
            .filter(e => e.entry_type === 'photo')
            .map(entry => (
              <div
                key={entry.id}
                className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-border"
              >
                <img
                  src={entry.photo_url}
                  alt="KOT"
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
                  <Check className="w-3 h-3 text-success mx-auto" />
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Info text */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>KOT photos help verify sales. Multiple staff can upload photos.</span>
      </div>

      {/* No KOT Declaration Dialog */}
      <Dialog open={showNoKotDialog} onOpenChange={setShowNoKotDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileX className="w-5 h-5 text-warning" />
              No KOT Received
            </DialogTitle>
            <DialogDescription>
              This declaration will be recorded for audit purposes. You will not be penalized.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Reason <span className="text-destructive">*</span>
              </label>
              <Select value={declarationReason} onValueChange={setDeclarationReason}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {DECLARATION_REASONS.map(reason => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Additional Note <span className="text-muted-foreground">(optional)</span>
              </label>
              <Textarea
                placeholder="Any additional details..."
                value={declarationNote}
                onChange={(e) => setDeclarationNote(e.target.value)}
                className="min-h-[80px] rounded-xl resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowNoKotDialog(false)}
              disabled={declaring}
              className="flex-1 h-11 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleNoKotDeclaration}
              disabled={declaring || !declarationReason}
              className="flex-1 h-11 rounded-xl bg-warning hover:bg-warning/90 text-warning-foreground"
            >
              {declaring ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Confirm Declaration"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KotProofSection;
