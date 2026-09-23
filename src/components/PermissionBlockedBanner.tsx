import { AlertTriangle, Settings } from "lucide-react";

interface PermissionBlockedBannerProps {
  type: "camera" | "location";
}

const instructions: Record<string, { title: string; steps: string[] }> = {
  camera: {
    title: "Camera access is blocked",
    steps: [
      "Tap the lock/info icon in your browser's address bar",
      "Find \"Camera\" and set it to \"Allow\"",
      "Refresh the page",
    ],
  },
  location: {
    title: "Location access is blocked",
    steps: [
      "Tap the lock/info icon in your browser's address bar",
      "Find \"Location\" and set it to \"Allow\"",
      "Refresh the page",
    ],
  },
};

const PermissionBlockedBanner = ({ type }: PermissionBlockedBannerProps) => {
  const info = instructions[type];

  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
        <p className="text-sm font-semibold text-destructive">{info.title}</p>
      </div>
      <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground pl-1">
        {info.steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
      >
        <Settings className="h-3.5 w-3.5" />
        Refresh page after enabling
      </button>
    </div>
  );
};

export default PermissionBlockedBanner;
