import { useListFiles, useGetStats, useTranslateAllFiles, useTranslateFile } from "@workspace/api-client-react";
import { Play, RotateCcw, AlertTriangle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/button";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getGetStatsQueryKey, getListFilesQueryKey } from "@workspace/api-client-react";

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { data: stats, isLoading: statsLoading } = useGetStats({ query: { refetchInterval: 3000, queryKey: getGetStatsQueryKey() } });
  const { data: files, isLoading: filesLoading } = useListFiles({ query: { refetchInterval: 3000, queryKey: getListFilesQueryKey() } });
  const translateAll = useTranslateAllFiles();
  const translateFile = useTranslateFile();

  const handleTranslateAll = () => {
    translateAll.mutate(undefined, {
      onSuccess: (res) => {
        toast.success(`Queued ${res.queued} files for translation.`);
        queryClient.invalidateQueries({ queryKey: getListFilesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
      },
      onError: (err) => {
        toast.error(`Error: ${(err as any).data?.error || "Failed to queue files"}`);
      }
    });
  };

  const handleTranslate = (filename: string) => {
    translateFile.mutate({ filename }, {
      onSuccess: () => {
        toast.success(`Queued ${filename}`);
        queryClient.invalidateQueries({ queryKey: getListFilesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
      },
      onError: (err) => {
        toast.error(`Error queuing ${filename}: ${(err as any).data?.error || "Unknown error"}`);
      }
    });
  };

  return (
    <div className="flex flex-col h-full absolute inset-0">
      {/* Telemetry Panel */}
      <div className="border-b border-border bg-card p-6 grid grid-cols-2 md:grid-cols-6 gap-6 items-end shrink-0">
        <StatBox label="Total Files" value={stats?.totalFiles ?? 0} />
        <StatBox label="Done" value={stats?.doneFiles ?? 0} colorClass="text-success" borderClass="border-success" />
        <StatBox label="Translating" value={stats?.translatingFiles ?? 0} colorClass="text-info" borderClass="border-info" />
        <StatBox label="Errors" value={stats?.errorFiles ?? 0} colorClass="text-destructive" borderClass="border-destructive" />
        <StatBox label="Lines Translated" value={stats ? `${stats.translatedLines} / ${stats.totalLines}` : "0 / 0"} className="col-span-2" />
      </div>

      <div className="p-6 flex-1 flex flex-col gap-4 overflow-hidden">
        <div className="flex items-center justify-between shrink-0">
          <h2 className="text-xl font-bold uppercase tracking-widest text-foreground">Script Files Registry</h2>
          <Button onClick={handleTranslateAll} disabled={translateAll.isPending} className="gap-2">
            <Play className="w-4 h-4" />
            Translate All Pending
          </Button>
        </div>

        <div className="border border-border bg-card flex-1 overflow-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-secondary text-secondary-foreground font-mono uppercase text-xs sticky top-0 z-10 shadow-[0_1px_0_hsl(var(--border))]">
              <tr>
                <th className="px-4 py-3 font-semibold w-1/4">Filename</th>
                <th className="px-4 py-3 font-semibold w-1/6">Status</th>
                <th className="px-4 py-3 font-semibold w-1/3">Progress</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono">
              {filesLoading ? (
                <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Loading registry...</td></tr>
              ) : files?.length === 0 ? (
                <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">No script files found.</td></tr>
              ) : (
                files?.map(file => (
                  <tr key={file.filename} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-2 font-bold text-xs">{file.filename}</td>
                    <td className="px-4 py-2">
                      <StatusBadge status={file.status} />
                      {file.errorMessage && (
                        <p className="text-[10px] text-destructive mt-1 whitespace-normal max-w-[200px] leading-tight" title={file.errorMessage}>
                          {file.errorMessage.length > 60 ? file.errorMessage.substring(0, 60) + "..." : file.errorMessage}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-col gap-1 w-full max-w-md">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span className="text-foreground">{file.translatedLines} / {file.totalLines} lines</span>
                          {file.skippedLines > 0 && <span>({file.skippedLines} skipped)</span>}
                        </div>
                        <div className="h-1.5 w-full bg-secondary overflow-hidden">
                          <div 
                            className={cn("h-full transition-all duration-500 ease-out", file.status === "error" ? "bg-destructive" : "bg-primary")}
                            style={{ width: `${file.totalLines ? (file.translatedLines / file.totalLines) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={() => handleTranslate(file.filename)}
                        disabled={file.status === "translating" || file.status === "queued" || translateFile.isPending}
                        className="h-7 text-xs px-2"
                      >
                        {file.status === "error" ? <RotateCcw className="w-3 h-3 mr-1" /> : <Play className="w-3 h-3 mr-1" />}
                        {file.status === "error" ? "Retry" : "Translate"}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, colorClass = "text-foreground", borderClass = "border-border", className }: { label: string, value: string | number, colorClass?: string, borderClass?: string, className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1 border-l-4 pl-4 py-1", borderClass, className)}>
      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{label}</span>
      <span className={cn("text-4xl font-sans font-bold leading-none tracking-tight", colorClass)}>{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className = "gap-1 text-[10px] px-1.5 py-0.5 rounded-none";
  switch (status) {
    case "done": return <Badge variant="success" className={className}><CheckCircle2 className="w-2.5 h-2.5"/> Done</Badge>;
    case "error": return <Badge variant="destructive" className={className}><AlertTriangle className="w-2.5 h-2.5"/> Error</Badge>;
    case "translating": return <Badge variant="info" className={className}><Loader2 className="w-2.5 h-2.5 animate-spin"/> Translating</Badge>;
    case "queued": return <Badge variant="warning" className={className}><Clock className="w-2.5 h-2.5"/> Queued</Badge>;
    default: return <Badge variant="outline" className={className}>Pending</Badge>;
  }
}
