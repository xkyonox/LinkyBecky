import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LinkItem } from "./link-item";
import { LinkDialog } from "./link-form";
import { AiInsights } from "./ai-insights";
import { useLinkStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Plus } from "lucide-react";
import { type Link } from "@/types";

export function LinkList() {
  const { links, setLinks, reorderLinks } = useLinkStore();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Fetch links from the API
  const { data, isLoading, error } = useQuery({ 
    queryKey: ['/api/links'],
  });

  // Mutation for reordering links
  const reorderMutation = useMutation({
    mutationFn: async (linkPositions: { id: number; position: number }[]) => {
      await apiRequest('POST', '/api/links/reorder', linkPositions);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/links'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save link order. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Update local store when data is fetched
  useEffect(() => {
    if (data) {
      setLinks(data);
    }
  }, [data, setLinks]);

  // Handle drag end event
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    
    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;
    
    if (sourceIndex === destinationIndex) return;
    
    // Create a copy of the links array
    const reorderedLinks = Array.from(links);
    // Remove the dragged item
    const [removed] = reorderedLinks.splice(sourceIndex, 1);
    // Insert it at the new position
    reorderedLinks.splice(destinationIndex, 0, removed);
    
    // Update positions for all links
    const newLinkPositions = reorderedLinks.map((link, index) => ({
      id: link.id,
      position: index
    }));
    
    // Update local store
    reorderLinks(newLinkPositions);
    
    // Update the server
    reorderMutation.mutate(newLinkPositions);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <AiInsights />
        
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-medium text-gray-900">Manage Links</h2>
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" /> Add Link
          </Button>
        </div>
        
        {[...Array(3)].map((_, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-center space-x-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <div className="ml-auto flex items-center space-x-2">
                  <Skeleton className="h-6 w-14 rounded-full" />
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-6 w-6 rounded-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <h2 className="text-lg font-medium text-red-600 mb-2">Error loading links</h2>
        <p className="text-gray-500">There was a problem loading your links. Please try again later.</p>
        <Button 
          className="mt-4" 
          onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/links'] })}
        >
          Retry
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <AiInsights />
      
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-medium text-gray-900">Manage Links</h2>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Link
        </Button>
      </div>
      
      {links.length === 0 ? (
        <Card className="p-6 text-center">
          <h3 className="font-medium text-gray-900 mb-2">No links yet</h3>
          <p className="text-gray-500 mb-4">Add your first link to start building your profile</p>
          <Button 
            onClick={() => setIsCreateDialogOpen(true)}
            className="mx-auto"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Your First Link
          </Button>
        </Card>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="links">
            {(provided) => (
              <div
                className="space-y-4"
                {...provided.droppableProps}
                ref={provided.innerRef}
              >
                {links.map((link, index) => (
                  <Draggable key={link.id} draggableId={String(link.id)} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                      >
                        <LinkItem 
                          link={link} 
                          isDragging={snapshot.isDragging}
                          dragHandleProps={provided.dragHandleProps}
                        />
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}
      
      {/* Create Link Dialog */}
      <LinkDialog 
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        mode="create"
      />
    </div>
  );
}
