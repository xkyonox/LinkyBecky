import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useProfileStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Theme } from "@/types";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { HexColorPicker } from "react-colorful";
import { useState } from "react";

// Predefined themes
const themes: Theme[] = [
  { name: "Default", id: "light", primary: "#7c3aed", text: "#1f2937" },
  { name: "Dark", id: "dark", primary: "#4c1d95", text: "#f9fafb" },
  { name: "Ocean", id: "ocean", primary: "#0369a1", text: "#082f49" },
  { name: "Forest", id: "forest", primary: "#166534", text: "#14532d" },
  { name: "Sunset", id: "sunset", primary: "#b45309", text: "#78350f" },
];

export function ThemeSelector() {
  const { profile, setProfile, updateProfile } = useProfileStore();
  const { toast } = useToast();
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [currentColor, setCurrentColor] = useState("#7c3aed");

  // Fetch profile data
  const { data, isLoading } = useQuery({ 
    queryKey: ['/api/profile'],
  });

  // Update profile when data is fetched
  useEffect(() => {
    if (data) {
      setProfile(data);
      setCurrentColor(data.backgroundColor || "#7c3aed");
    }
  }, [data, setProfile]);

  // Update theme mutation
  const updateThemeMutation = useMutation({
    mutationFn: async (data: { theme: string, backgroundColor: string, textColor: string }) => {
      await apiRequest('PUT', '/api/profile', data);
    },
    onSuccess: () => {
      toast({
        title: "Theme updated",
        description: "Your profile theme has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update theme. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleThemeSelect = (theme: Theme) => {
    updateProfile({
      theme: theme.id,
      backgroundColor: theme.primary,
      textColor: theme.text,
    });
    
    setCurrentColor(theme.primary);
    
    updateThemeMutation.mutate({
      theme: theme.id,
      backgroundColor: theme.primary,
      textColor: theme.text,
    });
  };

  const handleColorChange = (color: string) => {
    setCurrentColor(color);
  };

  const handleColorChangeComplete = () => {
    updateProfile({
      backgroundColor: currentColor,
    });
    
    updateThemeMutation.mutate({
      theme: profile?.theme || "light",
      backgroundColor: currentColor,
      textColor: profile?.textColor || "#ffffff",
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="grid grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="text-lg font-medium mb-4">Themes</h3>
        
        <div className="grid grid-cols-5 gap-4 mb-6">
          {themes.map((theme) => (
            <Button
              key={theme.id}
              variant="outline"
              className={`flex flex-col items-center p-3 h-auto ${
                profile?.theme === theme.id 
                  ? 'border-primary-500 bg-primary-50' 
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
              onClick={() => handleThemeSelect(theme)}
            >
              <div 
                className="w-8 h-8 rounded-full" 
                style={{ backgroundColor: theme.primary }}
              ></div>
              <span className="mt-2 text-xs">{theme.name}</span>
            </Button>
          ))}
        </div>
        
        <div className="mb-6">
          <h4 className="text-sm font-medium mb-2">Custom Color</h4>
          <Button
            variant="outline"
            className="w-full flex justify-between items-center"
            onClick={() => setShowColorPicker(!showColorPicker)}
          >
            <span>Background Color</span>
            <div className="flex items-center">
              <div 
                className="w-6 h-6 rounded-full mr-2" 
                style={{ backgroundColor: currentColor }}
              ></div>
              <span className="text-sm">{currentColor}</span>
            </div>
          </Button>
          
          {showColorPicker && (
            <div className="mt-4">
              <div className="flex justify-center mb-4">
                <HexColorPicker 
                  color={currentColor} 
                  onChange={handleColorChange}
                />
              </div>
              <Button 
                className="w-full" 
                onClick={() => {
                  handleColorChangeComplete();
                  setShowColorPicker(false);
                }}
              >
                Apply Color
              </Button>
            </div>
          )}
        </div>
        
        <div>
          <h4 className="text-sm font-medium mb-2">Font Family</h4>
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="outline"
              className={`h-16 flex flex-col justify-center ${
                profile?.fontFamily === 'Inter' ? 'border-primary-500 bg-primary-50' : ''
              }`}
              onClick={() => {
                updateProfile({ fontFamily: 'Inter' });
                updateThemeMutation.mutate({
                  theme: profile?.theme || "light",
                  backgroundColor: profile?.backgroundColor || "#7c3aed",
                  textColor: profile?.textColor || "#ffffff",
                });
              }}
            >
              <span className="font-sans text-lg">Inter</span>
              <span className="text-xs text-gray-500">Default</span>
            </Button>
            
            <Button
              variant="outline"
              className={`h-16 flex flex-col justify-center ${
                profile?.fontFamily === 'serif' ? 'border-primary-500 bg-primary-50' : ''
              }`}
              onClick={() => {
                updateProfile({ fontFamily: 'serif' });
                updateThemeMutation.mutate({
                  theme: profile?.theme || "light",
                  backgroundColor: profile?.backgroundColor || "#7c3aed",
                  textColor: profile?.textColor || "#ffffff",
                });
              }}
            >
              <span className="font-serif text-lg">Serif</span>
              <span className="text-xs text-gray-500">Classic</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
