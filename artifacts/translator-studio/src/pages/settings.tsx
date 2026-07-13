import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useGetSettings, useUpdateSettings, useDetectModels, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/button";
import { RefreshCw, Save, KeyRound, Server, Zap, Layers, AlertCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

// zod schema
const settingsSchema = z.object({
  baseUrl: z.string().min(1, "Base URL is required").url("Must be a valid URL"),
  apiKey: z.string().optional(),
  // No model may exist yet on first save -- models are only known after the
  // provider has been detected, which happens as a side effect of saving
  // baseUrl/apiKey. Requiring a model up front would make initial setup
  // impossible.
  model: z.string().optional(),
  concurrency: z.coerce.number().min(1).max(50),
  batchSize: z.coerce.number().min(1).max(100),
});

export default function Settings() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const detectModels = useDetectModels();

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      baseUrl: "",
      apiKey: "",
      model: "",
      concurrency: 1,
      batchSize: 10,
    }
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        baseUrl: settings.baseUrl,
        apiKey: "", // write-only
        model: settings.model || "",
        concurrency: settings.concurrency,
        batchSize: settings.batchSize,
      });
    }
  }, [settings, form]);

  const onSubmit = (data: z.infer<typeof settingsSchema>) => {
    // only send apiKey/model if provided -- both can be legitimately absent
    // on a first save (no key yet typed in this session, no model detected yet)
    const payload = { ...data };
    if (!payload.apiKey) {
      delete payload.apiKey;
    }
    if (!payload.model) {
      delete payload.model;
    }

    updateSettings.mutate({ data: payload }, {
      onSuccess: (updated) => {
        if (updated.lastDetectError) {
          toast.error(`Settings saved, but model detection failed: ${updated.lastDetectError}`);
        } else {
          toast.success("Settings saved successfully.");
        }
        // clear api key field, but pick up any newly detected model
        form.setValue("apiKey", "");
        form.setValue("model", updated.model ?? "");
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      },
      onError: (err) => {
        toast.error(`Error saving settings: ${(err as any).data?.error || "Unknown error"}`);
      }
    });
  };

  const handleDetectModels = () => {
    detectModels.mutate(undefined, {
      onSuccess: () => {
        toast.success("Models detected successfully.");
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      },
      onError: (err) => {
        toast.error(`Error detecting models: ${(err as any).data?.error || "Unknown error"}`);
      }
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto flex flex-col gap-8">
         <div className="text-muted-foreground font-mono uppercase tracking-widest text-sm animate-pulse">Loading Configuration...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto flex flex-col gap-8 w-full">
      <div>
        <h1 className="text-3xl font-bold uppercase tracking-widest mb-2">Provider Config</h1>
        <p className="text-muted-foreground font-mono text-sm">Configure your AI provider endpoint and throughput parameters. Saving credentials automatically triggers model auto-detection.</p>
      </div>

      <div className="bg-card border border-border shadow-sm">
        <div className="border-b border-border px-6 py-4 bg-secondary">
          <h2 className="font-bold font-mono uppercase text-secondary-foreground flex items-center gap-2">
            <Server className="w-4 h-4 text-primary" />
            Connection & Models
          </h2>
        </div>
        
        <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 flex flex-col gap-6">
          <div className="grid gap-2">
            <label className="text-xs font-bold uppercase tracking-wide text-foreground">Base URL</label>
            <input 
              {...form.register("baseUrl")} 
              className="flex h-10 w-full border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
              placeholder="https://api.openai.com/v1"
            />
            {form.formState.errors.baseUrl && <span className="text-destructive text-xs font-mono">{form.formState.errors.baseUrl.message}</span>}
          </div>

          <div className="grid gap-2">
            <label className="text-xs font-bold uppercase tracking-wide flex justify-between text-foreground">
              <span>API Key</span>
              {settings?.hasApiKey && <span className="text-success text-[10px] flex items-center gap-1"><KeyRound className="w-3 h-3"/> Configured</span>}
            </label>
            <input 
              {...form.register("apiKey")} 
              type="password"
              className="flex h-10 w-full border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
              placeholder={settings?.hasApiKey ? "•••••••••••••••• (Leave blank to keep unchanged)" : "sk-..."}
            />
          </div>

          <div className="grid gap-2 pt-2 border-t border-border mt-2">
            <div className="flex justify-between items-end mb-1">
              <label className="text-xs font-bold uppercase tracking-wide text-foreground">Model Selection</label>
              <Button type="button" variant="outline" size="sm" onClick={handleDetectModels} disabled={detectModels.isPending} className="h-8">
                <RefreshCw className={cn("w-3 h-3 mr-2", detectModels.isPending && "animate-spin")} />
                Re-detect
              </Button>
            </div>
            
            {settings?.lastDetectError ? (
              <div className="p-3 bg-destructive/10 text-destructive border border-destructive/20 text-sm font-mono flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Detection failed: {settings.lastDetectError}</span>
              </div>
            ) : null}

            <select 
              {...form.register("model")}
              className="flex h-10 w-full border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 font-mono uppercase"
            >
              <option value="" disabled>Select a model...</option>
              {settings?.models?.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <div className="flex justify-between mt-1">
              {form.formState.errors.model && <span className="text-destructive text-xs font-mono">{form.formState.errors.model.message}</span>}
              {settings?.lastDetectedAt && (
                <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wide ml-auto">Updated: {new Date(settings.lastDetectedAt).toLocaleString()}</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 pt-6 border-t border-border mt-2">
            <div className="grid gap-2">
              <label className="text-xs font-bold uppercase tracking-wide flex items-center gap-2 text-foreground">
                <Zap className="w-4 h-4 text-primary" />
                Concurrency
              </label>
              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wide mb-1">Max parallel files.</p>
              <input 
                {...form.register("concurrency")} 
                type="number"
                min="1"
                className="flex h-10 w-full border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 font-mono"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-xs font-bold uppercase tracking-wide flex items-center gap-2 text-foreground">
                <Layers className="w-4 h-4 text-primary" />
                Batch Size
              </label>
              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wide mb-1">Lines per request.</p>
              <input 
                {...form.register("batchSize")} 
                type="number"
                min="1"
                className="flex h-10 w-full border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 font-mono"
              />
            </div>
          </div>

          <div className="pt-6 mt-2 border-t border-border flex justify-end">
            <Button type="submit" disabled={updateSettings.isPending} className="w-full md:w-auto">
              <Save className="w-4 h-4 mr-2" />
              Save Configuration
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
