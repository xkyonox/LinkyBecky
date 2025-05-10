import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "@/types";
import { useLinkStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { getIconFromUrl } from "@/lib/utils";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, ChevronsUpDown, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Define the schema for the form
const linkSchema = z.object({
  title: z.string().min(1, "Title is required"),
  url: z.string().url("Please enter a valid URL"),
  description: z.string().optional(),
  iconType: z.string().default("fas fa-link"),
  enabled: z.boolean().default(true),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmTerm: z.string().optional(),
  utmContent: z.string().optional(),
});

type LinkFormValues = z.infer<typeof linkSchema>;

interface LinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  link?: Link;
  mode: "create" | "edit";
}

export function LinkDialog({ open, onOpenChange, link, mode }: LinkDialogProps) {
  const { addLink, updateLink } = useLinkStore();
  const { toast } = useToast();
  const [isUtmOpen, setIsUtmOpen] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<{
    title: string;
    description: string;
    cta: string;
  } | null>(null);

  // Set up form with default values
  const form = useForm<LinkFormValues>({
    resolver: zodResolver(linkSchema),
    defaultValues: {
      title: link?.title || "",
      url: link?.url || "",
      description: link?.description || "",
      iconType: link?.iconType || "fas fa-link",
      enabled: link?.enabled !== undefined ? link.enabled : true,
      utmSource: link?.utmSource || "",
      utmMedium: link?.utmMedium || "",
      utmCampaign: link?.utmCampaign || "",
      utmTerm: link?.utmTerm || "",
      utmContent: link?.utmContent || "",
    },
  });

  const { handleSubmit, reset, formState, setValue, watch } = form;
  const url = watch("url");
  const isSubmitting = formState.isSubmitting;

  useEffect(() => {
    if (open) {
      reset({
        title: link?.title || "",
        url: link?.url || "",
        description: link?.description || "",
        iconType: link?.iconType || "fas fa-link",
        enabled: link?.enabled !== undefined ? link.enabled : true,
        utmSource: link?.utmSource || "",
        utmMedium: link?.utmMedium || "",
        utmCampaign: link?.utmCampaign || "",
        utmTerm: link?.utmTerm || "",
        utmContent: link?.utmContent || "",
      });
      
      // Check if we should open UTM section based on existing values
      setIsUtmOpen(
        !!(link?.utmSource || link?.utmMedium || link?.utmCampaign || link?.utmTerm || link?.utmContent)
      );
      
      // Reset AI suggestions
      setAiSuggestions(null);
    }
  }, [open, link, reset]);

  const onSubmit = async (data: LinkFormValues) => {
    try {
      if (mode === "create") {
        // Create new link
        const response = await apiRequest("POST", "/api/links", data);
        const newLink = await response.json();
        addLink(newLink);
        
        toast({
          title: "Link created",
          description: "Your new link has been added successfully.",
        });
      } else if (mode === "edit" && link) {
        // Update existing link
        const response = await apiRequest("PUT", `/api/links/${link.id}`, data);
        const updatedLink = await response.json();
        updateLink(link.id, updatedLink);
        
        toast({
          title: "Link updated",
          description: "Your link has been updated successfully.",
        });
      }
      
      // Close dialog and invalidate query cache
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ['/api/links'] });
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${mode === "create" ? "create" : "update"} link. Please try again.`,
        variant: "destructive",
      });
    }
  };

  const detectIconFromUrl = () => {
    if (url) {
      const iconType = getIconFromUrl(url);
      setValue("iconType", iconType);
    }
  };

  const getAiSuggestions = async () => {
    if (!url) {
      toast({
        title: "URL required",
        description: "Please enter a URL to get AI suggestions.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsAiLoading(true);
      const response = await apiRequest("POST", "/api/ai/link-suggestions", { url });
      const suggestions = await response.json();
      setAiSuggestions(suggestions);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to get AI suggestions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  const applyAiSuggestion = (field: "title" | "description") => {
    if (aiSuggestions) {
      setValue(field, aiSuggestions[field], { shouldValidate: true });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add New Link" : "Edit Link"}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Tabs defaultValue="basic">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
              </TabsList>
              
              <TabsContent value="basic" className="space-y-4 pt-4">
                {/* URL Field */}
                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL</FormLabel>
                      <div className="flex space-x-2">
                        <FormControl>
                          <Input 
                            placeholder="https://example.com" 
                            {...field} 
                            onChange={(e) => {
                              field.onChange(e);
                              // Auto-detect icon type when URL changes
                              if (e.target.value) {
                                detectIconFromUrl();
                              }
                            }}
                          />
                        </FormControl>
                        <Button 
                          type="button" 
                          variant="outline" 
                          className="shrink-0"
                          onClick={getAiSuggestions}
                          disabled={isAiLoading || !url}
                        >
                          {isAiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* AI Suggestions Alert */}
                {aiSuggestions && (
                  <Alert className="bg-blue-50 text-blue-800 border-blue-200">
                    <AlertDescription className="space-y-2">
                      <p className="text-sm font-medium">AI Suggestions</p>
                      <div className="flex items-center justify-between">
                        <p className="text-xs line-clamp-1">{aiSuggestions.title}</p>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-xs"
                          onClick={() => applyAiSuggestion("title")}
                        >
                          Use
                        </Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs line-clamp-1">{aiSuggestions.description}</p>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-xs"
                          onClick={() => applyAiSuggestion("description")}
                        >
                          Use
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
                
                {/* Title Field */}
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="My awesome link" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Description Field */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Briefly describe this link" 
                          className="resize-none"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Enabled Switch */}
                <FormField
                  control={form.control}
                  name="enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Enabled</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Display this link on your public profile
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </TabsContent>
              
              <TabsContent value="advanced" className="space-y-4 pt-4">
                {/* Icon Type Field */}
                <FormField
                  control={form.control}
                  name="iconType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Icon Type</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <p className="text-sm text-muted-foreground mt-1">
                        Use Font Awesome icon classes (e.g., fas fa-link)
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* UTM Parameters */}
                <Collapsible
                  open={isUtmOpen}
                  onOpenChange={setIsUtmOpen}
                  className="border rounded-lg p-3"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">UTM Parameters</h4>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <ChevronsUpDown className="h-4 w-4" />
                        <span className="sr-only">Toggle UTM parameters</span>
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent className="space-y-4 mt-2">
                    <FormField
                      control={form.control}
                      name="utmSource"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Source</FormLabel>
                          <FormControl>
                            <Input placeholder="utm_source" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="utmMedium"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Medium</FormLabel>
                          <FormControl>
                            <Input placeholder="utm_medium" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="utmCampaign"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Campaign</FormLabel>
                          <FormControl>
                            <Input placeholder="utm_campaign" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="utmTerm"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Term</FormLabel>
                          <FormControl>
                            <Input placeholder="utm_term" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="utmContent"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Content</FormLabel>
                          <FormControl>
                            <Input placeholder="utm_content" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CollapsibleContent>
                </Collapsible>
              </TabsContent>
            </Tabs>
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {mode === "create" ? "Add Link" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
